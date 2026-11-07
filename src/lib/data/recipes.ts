import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toMinor } from "@/lib/money";
import type { PantryStock } from "@/lib/recipes/cost";
import { parseUnit, type UnitSpec } from "@/lib/units";
import {
  priceBasisFromProduct,
  type LastPurchase,
  type PricingLookup,
  type ProductPricing,
  type RetailerQuote,
} from "@/lib/recipes/pricing";
import {
  normaliseCategory,
  normaliseUnit,
  type ProductOption,
  type RecipeIngredientRow,
  type RecipeRow,
  type RecipeWithIngredients,
  type SubstitutionRow,
} from "@/lib/recipes/types";

export const RECIPE_MEDIA_BUCKET = "household-media";
const SIGNED_URL_SECONDS = 60 * 60;

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

const RECIPE_COLUMNS =
  "id, title, description, servings, prep_minutes, cook_minutes, instructions, category, tags, image_path, source_url, is_favorite, created_at";
const INGREDIENT_COLUMNS = "id, recipe_id, product_id, name, quantity, unit, is_optional, is_at_home, note, sort_order";

type RawRecipe = Omit<RecipeRow, "servings" | "category"> & { servings: number | string; category: string | null };

function toRecipe(r: RawRecipe): RecipeRow {
  return { ...r, servings: Number(r.servings), category: normaliseCategory(r.category), tags: r.tags ?? [] };
}

interface RawIngredient {
  id: string;
  recipe_id: string;
  product_id: string | null;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  is_optional: boolean;
  is_at_home: boolean;
  note: string | null;
  sort_order: number;
}

interface RawSubstitution {
  id: string;
  ingredient_id: string;
  product_id: string | null;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  note: string | null;
  sort_order: number;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

async function loadIngredients(householdId: string, recipeIds: string[]): Promise<Map<string, RecipeIngredientRow[]>> {
  const byRecipe = new Map<string, RecipeIngredientRow[]>();
  if (recipeIds.length === 0) return byRecipe;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select(INGREDIENT_COLUMNS)
    .eq("household_id", householdId)
    .in("recipe_id", recipeIds)
    .order("sort_order");
  if (error) fail("recipe ingredients", error.message);
  const ingredients = (data ?? []) as RawIngredient[];

  const subsByIngredient = new Map<string, SubstitutionRow[]>();
  if (ingredients.length > 0) {
    const { data: subs, error: subsError } = await supabase
      .from("recipe_ingredient_substitutions")
      .select("id, ingredient_id, product_id, name, quantity, unit, note, sort_order")
      .eq("household_id", householdId)
      .in("ingredient_id", ingredients.map((i) => i.id))
      .order("sort_order");
    if (subsError) fail("ingredient substitutions", subsError.message);
    for (const s of (subs ?? []) as RawSubstitution[]) {
      const list = subsByIngredient.get(s.ingredient_id) ?? [];
      list.push({ id: s.id, product_id: s.product_id, name: s.name, quantity: num(s.quantity), unit: normaliseUnit(s.unit), note: s.note });
      subsByIngredient.set(s.ingredient_id, list);
    }
  }

  for (const i of ingredients) {
    const list = byRecipe.get(i.recipe_id) ?? [];
    list.push({
      id: i.id,
      product_id: i.product_id,
      name: i.name,
      quantity: num(i.quantity),
      unit: normaliseUnit(i.unit),
      is_optional: i.is_optional,
      is_at_home: i.is_at_home,
      note: i.note,
      sort_order: i.sort_order,
      substitutions: subsByIngredient.get(i.id) ?? [],
    });
    byRecipe.set(i.recipe_id, list);
  }
  return byRecipe;
}

export async function getRecipesWithIngredients(householdId: string): Promise<RecipeWithIngredients[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("household_id", householdId)
    .order("is_favorite", { ascending: false })
    .order("title");
  if (error) fail("recipes", error.message);
  const recipes = ((data ?? []) as RawRecipe[]).map(toRecipe);
  const ingredients = await loadIngredients(householdId, recipes.map((r) => r.id));
  return recipes.map((r) => ({ ...r, ingredients: ingredients.get(r.id) ?? [] }));
}

export async function getRecipe(householdId: string, id: string): Promise<RecipeWithIngredients | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select(RECIPE_COLUMNS).eq("household_id", householdId).eq("id", id).maybeSingle();
  if (error) fail("the recipe", error.message);
  if (!data) return null;
  const recipe = toRecipe(data as RawRecipe);
  const ingredients = await loadIngredients(householdId, [recipe.id]);
  return { ...recipe, ingredients: ingredients.get(recipe.id) ?? [] };
}

export async function getProductOptions(householdId: string): Promise<ProductOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, unit, package_size, package_unit")
    .eq("household_id", householdId)
    .eq("is_archived", false)
    .order("name")
    .limit(2000);
  if (error) fail("products", error.message);
  return ((data ?? []) as (Omit<ProductOption, "package_size"> & { package_size: number | string | null })[]).map((p) => ({
    ...p,
    package_size: num(p.package_size),
  }));
}

export async function getPantryStock(householdId: string, productIds: string[]): Promise<PantryStock[]> {
  if (productIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .select("product_id, quantity, unit")
    .eq("household_id", householdId)
    .in("product_id", productIds);
  if (error) fail("pantry", error.message);
  return ((data ?? []) as { product_id: string; quantity: number | string; unit: string | null }[]).map((p) => ({
    productId: p.product_id,
    quantity: Number(p.quantity),
    unit: parseUnit(p.unit),
  }));
}

/** Signed URLs for private recipe photos, keyed by storage path. Missing or unreadable files are skipped. */
export async function getImageUrls(paths: (string | null)[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(RECIPE_MEDIA_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error || !data) return {};
  const urls: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}

interface ProductRow {
  id: string;
  unit: string;
  package_size: number | string | null;
  package_unit: string | null;
  last_price: number | string | null;
  last_purchase_date: string | null;
  last_retailer_id: string | null;
}

interface PriceRow {
  product_id: string;
  retailer_id: string;
  price: number | string;
  currency: string;
  is_promo: boolean;
  promo_ends_on: string | null;
  observed_at: string;
  retailers: { name: string } | { name: string }[] | null;
}

interface SpecRow {
  product_id: string;
  unit_weight_g: number | string | null;
  unit_volume_ml: number | string | null;
  density_g_per_ml: number | string | null;
}

/**
 * PricingLookup backed by the household's own data: current retailer prices (`product_prices`, filled by the price
 * adapters and by manual entry), product unit specs and the last purchase price kept on `products`.
 * Prices in another currency and promotions that already ended are skipped rather than converted or guessed.
 */
export async function createSupabasePricingLookup(options: {
  householdId: string;
  currency: string;
  today: string;
}): Promise<PricingLookup> {
  const supabase = await createClient();
  const { householdId, currency, today } = options;

  return {
    async getPricing(productIds) {
      const ids = [...productIds];
      if (ids.length === 0) return [];

      const [products, prices, specs] = await Promise.all([
        supabase
          .from("products")
          .select("id, unit, package_size, package_unit, last_price, last_purchase_date, last_retailer_id")
          .eq("household_id", householdId)
          .in("id", ids),
        supabase
          .from("product_prices")
          .select("product_id, retailer_id, price, currency, is_promo, promo_ends_on, observed_at, retailers(name)")
          .eq("household_id", householdId)
          .eq("currency", currency)
          .in("product_id", ids),
        supabase
          .from("product_unit_specs")
          .select("product_id, unit_weight_g, unit_volume_ml, density_g_per_ml")
          .eq("household_id", householdId)
          .in("product_id", ids),
      ]);
      if (products.error) fail("products", products.error.message);
      if (prices.error) fail("prices", prices.error.message);
      if (specs.error) fail("unit specs", specs.error.message);

      const productRows = (products.data ?? []) as ProductRow[];
      const retailerIds = [...new Set(productRows.map((p) => p.last_retailer_id).filter((r): r is string => !!r))];
      const retailerNames = new Map<string, string>();
      if (retailerIds.length > 0) {
        const { data } = await supabase.from("retailers").select("id, name").in("id", retailerIds);
        for (const r of (data ?? []) as { id: string; name: string }[]) retailerNames.set(r.id, r.name);
      }

      const quotesByProduct = new Map<string, RetailerQuote[]>();
      for (const row of (prices.data ?? []) as unknown as PriceRow[]) {
        if (row.is_promo && row.promo_ends_on && row.promo_ends_on < today) continue;
        const retailer = Array.isArray(row.retailers) ? row.retailers[0] : row.retailers;
        const list = quotesByProduct.get(row.product_id) ?? [];
        list.push({
          retailerId: row.retailer_id,
          retailerName: retailer?.name ?? "",
          priceMinor: toMinor(row.price),
          isPromo: row.is_promo,
          observedAt: row.observed_at,
        });
        quotesByProduct.set(row.product_id, list);
      }

      const specByProduct = new Map<string, UnitSpec>();
      for (const s of (specs.data ?? []) as SpecRow[]) {
        specByProduct.set(s.product_id, {
          unitWeightG: num(s.unit_weight_g),
          unitVolumeMl: num(s.unit_volume_ml),
          densityGPerMl: num(s.density_g_per_ml),
        });
      }

      return productRows.map<ProductPricing>((p) => {
        const quotes = quotesByProduct.get(p.id) ?? [];
        // One quote per retailer: the cheapest of its stores.
        const perRetailer = new Map<string, RetailerQuote>();
        for (const q of quotes) {
          const existing = perRetailer.get(q.retailerId);
          if (!existing || q.priceMinor < existing.priceMinor) perRetailer.set(q.retailerId, q);
        }
        const lastPurchase: LastPurchase | null =
          p.last_price === null
            ? null
            : {
                unitPriceMinor: toMinor(p.last_price),
                purchasedOn: p.last_purchase_date,
                retailerId: p.last_retailer_id,
                retailerName: p.last_retailer_id ? (retailerNames.get(p.last_retailer_id) ?? null) : null,
              };
        return {
          productId: p.id,
          basis: priceBasisFromProduct({ unit: p.unit, package_size: num(p.package_size), package_unit: p.package_unit }),
          spec: specByProduct.get(p.id) ?? {},
          quotes: [...perRetailer.values()],
          lastPurchase,
        };
      });
    },
  };
}
