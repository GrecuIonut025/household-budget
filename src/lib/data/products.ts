import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import { barcodeVariants, normalizeBarcode } from "@/lib/products/gtin";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/products/constants";
import type { PriceRow, ProductRow, ProductWithBarcodes, PurchaseRow, RetailerRow } from "@/lib/products/types";

const PRODUCT_COLUMNS =
  "id, name, brand, category, unit, package_size, package_unit, image_path, notes, is_archived, is_favorite, is_frequent, preferred_retailer_id, data_source, purchase_count, total_quantity, total_spent, avg_price, min_price, max_price, last_price, last_purchase_date, last_retailer_id";

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function normaliseProduct(row: Record<string, unknown>): ProductRow {
  return {
    ...(row as unknown as ProductRow),
    package_size: numOrNull(row.package_size),
    purchase_count: num(row.purchase_count),
    total_quantity: num(row.total_quantity),
    total_spent: num(row.total_spent),
    avg_price: numOrNull(row.avg_price),
    min_price: numOrNull(row.min_price),
    max_price: numOrNull(row.max_price),
    last_price: numOrNull(row.last_price),
  };
}

function withBarcodes(row: Record<string, unknown>): ProductWithBarcodes {
  const barcodes = ((row.product_barcodes as { barcode: string }[] | null) ?? []).map((b) => b.barcode).sort();
  return { ...normaliseProduct(row), barcodes };
}

/** `any` includes archived products (used by rankings, where history may reference them). */
export type ProductFilter = "all" | "favorites" | "frequent" | "archived" | "any";

/** Escapes characters that are special inside PostgREST `ilike` / `or()` filters. */
function likePattern(q: string): string {
  const cleaned = q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ");
  return `%${cleaned.trim()}%`;
}

export async function getProducts(
  householdId: string,
  opts: { q?: string; filter?: ProductFilter; limit?: number } = {},
): Promise<ProductWithBarcodes[]> {
  const supabase = await createClient();
  const filter = opts.filter ?? "all";
  const q = opts.q?.trim() ?? "";
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 10_000);

  const lidlId = filter === "any" ? null : await getLidlRetailerId();
  // Over-fetch then drop Lidl rows so household products aren't crowded out of `limit`.
  const fetchLimit = filter === "any" ? limit : Math.min(10_000, Math.max(limit * 40, 2_000));

  let query = supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS}, product_barcodes(barcode)`)
    .eq("household_id", householdId)
    .order("is_favorite", { ascending: false })
    .order("name")
    .limit(fetchLimit);
  if (filter !== "any") {
    query = query.eq("is_archived", filter === "archived");
    // XLSB imports; preferred=Lidl covers fallbacks stored as data_source=manual.
    query = query.neq("data_source", "lidl_xlsb");
  }
  if (filter === "favorites") query = query.eq("is_favorite", true);
  if (filter === "frequent") query = query.eq("is_frequent", true);

  if (q) {
    const pattern = likePattern(q);
    const digits = normalizeBarcode(q);
    const matchedIds: string[] = [];
    if (/^\d{4,14}$/.test(digits)) {
      const variants = barcodeVariants(digits);
      const { data } = await supabase
        .from("product_barcodes")
        .select("product_id")
        .eq("household_id", householdId)
        .or([`barcode.like.${digits}%`, ...variants.map((v) => `barcode.eq.${v}`)].join(","));
      matchedIds.push(...(data ?? []).map((r) => r.product_id as string));
    }
    const clauses = [`name.ilike.${pattern}`, `brand.ilike.${pattern}`];
    if (matchedIds.length) clauses.push(`id.in.(${matchedIds.join(",")})`);
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query;
  if (error) fail("products", error.message);
  const rows = (data ?? []).map(withBarcodes);
  if (filter === "any") return rows;
  return rows
    .filter(
      (p) =>
        p.data_source !== "lidl_xlsb" &&
        (!lidlId || p.preferred_retailer_id !== lidlId),
    )
    .slice(0, limit);
}

/** Cached Lidl retailer id for catalogue exclusion (null if seed missing). */
async function getLidlRetailerId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("retailers").select("id").eq("slug", "lidl").maybeSingle();
  return typeof data?.id === "string" ? data.id : null;
}

export async function getProduct(householdId: string, id: string): Promise<ProductWithBarcodes | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_COLUMNS}, product_barcodes(barcode)`)
    .eq("household_id", householdId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("product", error.message);
  return data ? withBarcodes(data) : null;
}

function normalisePurchase(row: Record<string, unknown>): PurchaseRow {
  return {
    ...(row as unknown as PurchaseRow),
    quantity: num(row.quantity),
    unit_price: num(row.unit_price),
    total_price: num(row.total_price),
  };
}

const PURCHASE_COLUMNS =
  "id, product_id, retailer_id, transaction_id, purchased_on, quantity, unit_price, total_price, is_promo, purchased_by, created_at";

export async function getPurchaseHistory(householdId: string, productId: string, limit = 100): Promise<PurchaseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_purchase_history")
    .select(PURCHASE_COLUMNS)
    .eq("household_id", householdId)
    .eq("product_id", productId)
    .order("purchased_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("purchase history", error.message);
  return (data ?? []).map(normalisePurchase);
}

/** Recent household purchases for rankings (bounded: the newest 5000 rows inside the window). */
export async function getPurchasesSince(householdId: string, today: string, days: number): Promise<PurchaseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_purchase_history")
    .select(PURCHASE_COLUMNS)
    .eq("household_id", householdId)
    .gte("purchased_on", addDays(today, -days))
    .order("purchased_on", { ascending: false })
    .limit(5000);
  if (error) fail("purchases", error.message);
  return (data ?? []).map(normalisePurchase);
}

export async function getProductPrices(householdId: string, productIds?: string[]): Promise<PriceRow[]> {
  if (productIds && productIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from("product_prices")
    .select("product_id, retailer_id, price, currency, is_promo, observed_at")
    .eq("household_id", householdId)
    .limit(5000);
  if (productIds) query = query.in("product_id", productIds);
  const { data, error } = await query;
  if (error) fail("prices", error.message);
  return (data ?? []).map((r) => ({ ...(r as unknown as PriceRow), price: num(r.price) }));
}

/** Active retailers for UI pickers — Lidl is hidden from the catalogue UX. */
export async function getRetailers(): Promise<RetailerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("retailers").select("id, slug, name").eq("is_active", true).order("name");
  if (error) fail("retailers", error.message);
  return ((data ?? []) as RetailerRow[]).filter((r) => r.slug !== "lidl");
}

/** Product ids for each household barcode spelling; used by the scanner. */
export async function findProductByBarcode(householdId: string, code: string): Promise<string | null> {
  const variants = barcodeVariants(code);
  if (variants.length === 0) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_barcodes")
    .select("product_id")
    .eq("household_id", householdId)
    .in("barcode", variants)
    .limit(1);
  if (error) fail("barcode", error.message);
  return (data?.[0]?.product_id as string | undefined) ?? null;
}

/** Signed URLs (1 hour) for private product images, keyed by storage path. */
export async function signProductImages(paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).createSignedUrls(unique, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}
