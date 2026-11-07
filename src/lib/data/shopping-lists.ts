import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toMinor } from "@/lib/money";
import { getPantryStock, createSupabasePricingLookup } from "@/lib/data/recipes";
import { getMealPlansWithIngredients } from "@/lib/data/meal-plans";
import { scaleFactor } from "@/lib/recipes/scaling";
import { lookupPricing } from "@/lib/recipes/pricing";
import {
  atHomeKeysFromIngredients,
  compareStrategies,
  mergeIngredients,
  priceShoppingNeeds,
  subtractPantry,
  type MergedNeed,
  type RecipeIngredientNeed,
  type ShoppingNeed,
  type StrategyKind,
  type StrategyResult,
  type PricedShoppingLine,
} from "@/lib/shopping";

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

/** PostgREST / Postgres when a selected column is not in the live schema yet. */
function isMissingColumnError(message: string): boolean {
  return /column .+ does not exist/i.test(message) || /Could not find the '.+' column/i.test(message);
}

const LIST_SELECT_BASE =
  "id, name, status, scope, retailer_id, planned_for, planned_budget, completed_at, created_at, shopping_list_items(id, is_checked, quantity, estimated_unit_price, actual_unit_price)";
const LIST_SELECT_FULL =
  "id, name, status, scope, retailer_id, preferred_retailer_id, strategy, planned_for, planned_budget, meal_week_start, completed_at, created_at, shopping_list_items(id, is_checked, quantity, estimated_unit_price, actual_unit_price)";
const LIST_DETAIL_BASE =
  "id, name, status, scope, retailer_id, planned_for, planned_budget, completed_at, created_at";
const LIST_DETAIL_FULL =
  "id, name, status, scope, retailer_id, preferred_retailer_id, strategy, planned_for, planned_budget, meal_week_start, completed_at, created_at";
const ITEM_COLUMNS_BASE =
  "id, product_id, recipe_id, name, quantity, unit, estimated_unit_price, actual_unit_price, is_checked, note, sort_order";
const ITEM_COLUMNS_FULL =
  "id, product_id, recipe_id, name, quantity, unit, estimated_unit_price, actual_unit_price, is_checked, note, sort_order, retailer_id";

function mapListItemsEmbed(
  items: Array<{
    id: string;
    is_checked: boolean;
    quantity: number | string;
    estimated_unit_price: number | string | null;
    actual_unit_price: number | string | null;
  }>,
): { item_count: number; checked_count: number; estimated_total: number | null } {
  let estimated: number | null = null;
  for (const item of items) {
    const price = item.actual_unit_price ?? item.estimated_unit_price;
    if (price === null) continue;
    estimated = (estimated ?? 0) + Number(item.quantity) * Number(price);
  }
  return {
    item_count: items.length,
    checked_count: items.filter((i) => i.is_checked).length,
    estimated_total: estimated === null ? null : Math.round(estimated * 100) / 100,
  };
}

function mapListRow(row: Record<string, unknown>): ShoppingListRow {
  const items =
    (row.shopping_list_items as Array<{
      id: string;
      is_checked: boolean;
      quantity: number | string;
      estimated_unit_price: number | string | null;
      actual_unit_price: number | string | null;
    }>) ?? [];
  const counts = mapListItemsEmbed(items);
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as ShoppingListStatus,
    scope: row.scope as "shared" | "individual",
    retailer_id: (row.retailer_id as string | null) ?? null,
    preferred_retailer_id: (row.preferred_retailer_id as string | null) ?? null,
    strategy: (row.strategy as StrategyKind | null) ?? null,
    planned_for: (row.planned_for as string | null) ?? null,
    planned_budget:
      row.planned_budget === null || row.planned_budget === undefined ? null : Number(row.planned_budget),
    meal_week_start: (row.meal_week_start as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: row.created_at as string,
    ...counts,
  };
}

export type ShoppingListStatus = "draft" | "active" | "completed" | "archived";

export interface ShoppingListRow {
  id: string;
  name: string;
  status: ShoppingListStatus;
  scope: "shared" | "individual";
  retailer_id: string | null;
  preferred_retailer_id: string | null;
  strategy: StrategyKind | null;
  planned_for: string | null;
  planned_budget: number | null;
  meal_week_start: string | null;
  completed_at: string | null;
  created_at: string;
  item_count: number;
  checked_count: number;
  estimated_total: number | null;
}

export interface ShoppingListItemRow {
  id: string;
  product_id: string | null;
  recipe_id: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  estimated_unit_price: number | null;
  actual_unit_price: number | null;
  is_checked: boolean;
  note: string | null;
  sort_order: number;
  retailer_id: string | null;
}

export interface ShoppingListDetail extends Omit<ShoppingListRow, "item_count" | "checked_count" | "estimated_total"> {
  items: ShoppingListItemRow[];
  reservation_amount: number | null;
  reservation_id: string | null;
}

export interface RetailerOption {
  id: string;
  name: string;
  slug: string;
}

export async function getRetailers(): Promise<RetailerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("retailers").select("id, name, slug").order("name");
  if (error) fail("retailers", error.message);
  return (data ?? []) as RetailerOption[];
}

/** Compact rows for the dashboard — only columns from the base shopping_lists schema. */
export interface ShoppingListPreview {
  id: string;
  name: string;
  status: ShoppingListStatus;
  scope: "shared" | "individual";
  planned_budget: number | null;
  item_count: number;
  checked_count: number;
  estimated_total: number | null;
}

/**
 * Overview widget only. Avoids meal-planner columns (`preferred_retailer_id`,
 * `strategy`, `meal_week_start`) so a DB that has not yet applied that migration
 * still loads the dashboard. Returns [] on error instead of throwing.
 */
export async function getShoppingListPreviews(householdId: string): Promise<ShoppingListPreview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_lists")
    .select(
      "id, name, status, scope, planned_budget, shopping_list_items(id, is_checked, quantity, estimated_unit_price, actual_unit_price)",
    )
    .eq("household_id", householdId)
    .in("status", ["draft", "active"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("Could not load shopping list previews:", error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const items =
      (row.shopping_list_items as Array<{
        id: string;
        is_checked: boolean;
        quantity: number | string;
        estimated_unit_price: number | string | null;
        actual_unit_price: number | string | null;
      }>) ?? [];
    let estimated: number | null = null;
    for (const item of items) {
      const price = item.actual_unit_price ?? item.estimated_unit_price;
      if (price === null) continue;
      estimated = (estimated ?? 0) + Number(item.quantity) * Number(price);
    }
    return {
      id: row.id as string,
      name: row.name as string,
      status: row.status as ShoppingListStatus,
      scope: row.scope as "shared" | "individual",
      planned_budget:
        row.planned_budget === null || row.planned_budget === undefined
          ? null
          : Number(row.planned_budget),
      item_count: items.length,
      checked_count: items.filter((i) => i.is_checked).length,
      estimated_total: estimated === null ? null : Math.round(estimated * 100) / 100,
    };
  });
}

/** Loose PostgREST result so FULL/BASE select fallbacks type-check. */
type LooseSelectResult = {
  data: unknown;
  error: { message: string } | null;
};

export async function getShoppingLists(householdId: string): Promise<ShoppingListRow[]> {
  const supabase = await createClient();
  let result: LooseSelectResult = await supabase
    .from("shopping_lists")
    .select(LIST_SELECT_FULL)
    .eq("household_id", householdId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (result.error && isMissingColumnError(result.error.message)) {
    result = await supabase
      .from("shopping_lists")
      .select(LIST_SELECT_BASE)
      .eq("household_id", householdId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
  }
  if (result.error) fail("shopping lists", result.error.message);

  return ((result.data ?? []) as Array<Record<string, unknown>>).map(mapListRow);
}

export async function getShoppingList(householdId: string, id: string): Promise<ShoppingListDetail | null> {
  const supabase = await createClient();
  let listResult: LooseSelectResult = await supabase
    .from("shopping_lists")
    .select(LIST_DETAIL_FULL)
    .eq("household_id", householdId)
    .eq("id", id)
    .maybeSingle();
  if (listResult.error && isMissingColumnError(listResult.error.message)) {
    listResult = await supabase
      .from("shopping_lists")
      .select(LIST_DETAIL_BASE)
      .eq("household_id", householdId)
      .eq("id", id)
      .maybeSingle();
  }
  if (listResult.error) fail("shopping list", listResult.error.message);
  if (!listResult.data) return null;

  let itemsResult: LooseSelectResult = await supabase
    .from("shopping_list_items")
    .select(ITEM_COLUMNS_FULL)
    .eq("household_id", householdId)
    .eq("list_id", id)
    .order("sort_order")
    .order("created_at");
  if (itemsResult.error && isMissingColumnError(itemsResult.error.message)) {
    itemsResult = await supabase
      .from("shopping_list_items")
      .select(ITEM_COLUMNS_BASE)
      .eq("household_id", householdId)
      .eq("list_id", id)
      .order("sort_order")
      .order("created_at");
  }

  const { data: reservation, error: resError } = await supabase
    .from("budget_reservations")
    .select("id, amount")
    .eq("household_id", householdId)
    .eq("shopping_list_id", id)
    .eq("status", "active")
    .maybeSingle();
  if (itemsResult.error) fail("shopping list items", itemsResult.error.message);
  if (resError) fail("reservation", resError.message);

  const row = listResult.data as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as ShoppingListStatus,
    scope: row.scope as "shared" | "individual",
    retailer_id: (row.retailer_id as string | null) ?? null,
    preferred_retailer_id: (row.preferred_retailer_id as string | null) ?? null,
    strategy: (row.strategy as StrategyKind | null) ?? null,
    planned_for: (row.planned_for as string | null) ?? null,
    planned_budget: row.planned_budget === null || row.planned_budget === undefined ? null : Number(row.planned_budget),
    meal_week_start: (row.meal_week_start as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: row.created_at as string,
    reservation_amount: reservation ? Number(reservation.amount) : null,
    reservation_id: reservation?.id ?? null,
    items: ((itemsResult.data ?? []) as Array<Record<string, unknown>>).map((i) => ({
      id: i.id as string,
      product_id: (i.product_id as string | null) ?? null,
      recipe_id: (i.recipe_id as string | null) ?? null,
      name: i.name as string,
      quantity: Number(i.quantity),
      unit: (i.unit as string | null) ?? null,
      estimated_unit_price:
        i.estimated_unit_price === null || i.estimated_unit_price === undefined
          ? null
          : Number(i.estimated_unit_price),
      actual_unit_price:
        i.actual_unit_price === null || i.actual_unit_price === undefined ? null : Number(i.actual_unit_price),
      is_checked: Boolean(i.is_checked),
      note: (i.note as string | null) ?? null,
      sort_order: Number(i.sort_order),
      retailer_id: (i.retailer_id as string | null) ?? null,
    })),
  };
}

export interface GeneratedBasket {
  needs: ShoppingNeed[];
  merged: MergedNeed[];
  lines: PricedShoppingLine[];
  strategies: StrategyResult[];
  estimatedTotalMinor: number | null;
}

/** Build a priced shopping basket from the week's meal plan (pure + DB reads). */
export async function generateBasketFromMealWeek(options: {
  householdId: string;
  currency: string;
  today: string;
  weekStart: string;
  weekEnd: string;
  preferredRetailerId?: string | null;
  includeOptional?: boolean;
}): Promise<GeneratedBasket> {
  const meals = await getMealPlansWithIngredients(options.householdId, options.weekStart, options.weekEnd);
  const ingredients: RecipeIngredientNeed[] = [];

  for (const meal of meals) {
    if (!meal.recipe_id || meal.ingredients.length === 0) continue;
    const base = meal.recipe_servings ?? 1;
    const target = meal.servings ?? base;
    const factor = scaleFactor(base, target);
    for (const ing of meal.ingredients) {
      if (ing.is_optional && !options.includeOptional) continue;
      ingredients.push({
        recipeId: meal.recipe_id,
        recipeTitle: meal.recipe_title ?? "Recipe",
        ingredientId: ing.id,
        name: ing.name,
        productId: ing.product_id,
        quantity: ing.quantity === null ? null : Number((ing.quantity * factor).toPrecision(12)),
        unit: ing.unit,
        isOptional: ing.is_optional,
        isAtHome: ing.is_at_home,
        note: ing.note,
      });
    }
  }

  const merged = mergeIngredients(ingredients);
  const productIds = merged.map((m) => m.productId).filter((id): id is string => !!id);
  const pantry = await getPantryStock(options.householdId, productIds);
  const needs = subtractPantry(merged, pantry, { atHomeKeys: atHomeKeysFromIngredients(ingredients) });

  const lookup = await createSupabasePricingLookup({
    householdId: options.householdId,
    currency: options.currency,
    today: options.today,
  });
  const pricing = await lookupPricing(lookup, productIds);
  const lines = priceShoppingNeeds(needs, pricing);
  const strategies = compareStrategies({
    lines,
    pricing,
    preferredRetailerId: options.preferredRetailerId,
  });
  const combo = strategies.find((s) => s.kind === "cheapest_combo");
  return {
    needs,
    merged,
    lines,
    strategies,
    estimatedTotalMinor: combo?.totalMinor ?? null,
  };
}

export async function estimateListTotalMinor(householdId: string, listId: string): Promise<number | null> {
  const list = await getShoppingList(householdId, listId);
  if (!list) return null;
  let total = 0;
  let any = false;
  for (const item of list.items) {
    const price = item.actual_unit_price ?? item.estimated_unit_price;
    if (price === null) continue;
    any = true;
    total += toMinor(price * item.quantity);
  }
  return any ? total : null;
}
