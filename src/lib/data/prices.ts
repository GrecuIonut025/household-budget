import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ComparisonQuote, HistoryPoint, MatchMethod, PriceAlertRow } from "@/lib/prices/types";

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export interface PriceDetailRow {
  id: string;
  product_id: string;
  retailer_id: string;
  store_id: string | null;
  price: number;
  currency: string;
  unit_price: number | null;
  unit_label: string | null;
  is_promo: boolean;
  loyalty_required: boolean;
  source: "adapter" | "manual";
  match_method: MatchMethod | null;
  match_confidence: number | null;
  is_verified: boolean;
  external_ref: string | null;
  source_url: string | null;
  observed_at: string;
}

export async function listPriceDetails(householdId: string, productIds?: string[]): Promise<PriceDetailRow[]> {
  if (productIds && productIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from("product_prices")
    .select(
      "id, product_id, retailer_id, store_id, price, currency, unit_price, unit_label, is_promo, loyalty_required, source, match_method, match_confidence, is_verified, external_ref, source_url, observed_at",
    )
    .eq("household_id", householdId)
    .limit(5000);
  if (productIds) query = query.in("product_id", productIds);
  const { data, error } = await query;
  if (error) fail("prices", error.message);
  return (data ?? []).map((r) => ({
    ...(r as unknown as PriceDetailRow),
    price: num(r.price),
    unit_price: numOrNull(r.unit_price),
    match_confidence: numOrNull(r.match_confidence),
    loyalty_required: Boolean(r.loyalty_required),
  }));
}

export async function listPriceHistory(
  householdId: string,
  productId: string,
  limit = 120,
): Promise<HistoryPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_price_history")
    .select("observed_at, price, retailer_id, is_promo, source")
    .eq("household_id", householdId)
    .eq("product_id", productId)
    .order("observed_at", { ascending: true })
    .limit(limit);
  if (error) fail("price history", error.message);
  return (data ?? []).map((r) => ({
    observedAt: r.observed_at as string,
    price: num(r.price),
    retailerId: r.retailer_id as string,
    isPromo: Boolean(r.is_promo),
    source: r.source as "adapter" | "manual",
  }));
}

export async function listPriceAlerts(householdId: string, userId?: string): Promise<PriceAlertRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("price_alerts")
    .select("id, product_id, retailer_id, direction, target_price, is_active, last_triggered_at, last_triggered_price")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) fail("price alerts", error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    productId: r.product_id as string,
    retailerId: (r.retailer_id as string | null) ?? null,
    direction: r.direction as "below" | "above",
    targetPrice: num(r.target_price),
    isActive: Boolean(r.is_active),
    lastTriggeredAt: (r.last_triggered_at as string | null) ?? null,
    lastTriggeredPrice: numOrNull(r.last_triggered_price),
  }));
}

export function toComparisonQuotes(
  rows: PriceDetailRow[],
  retailers: { id: string; slug: string; name: string }[],
): ComparisonQuote[] {
  const byId = new Map(retailers.map((r) => [r.id, r]));
  return rows.map((r) => {
    const retailer = byId.get(r.retailer_id);
    return {
      productId: r.product_id,
      retailerId: r.retailer_id,
      retailerSlug: retailer?.slug ?? "unknown",
      retailerName: retailer?.name ?? "—",
      price: r.price,
      currency: r.currency,
      unitPrice: r.unit_price,
      unitLabel: r.unit_label,
      isPromo: r.is_promo,
      loyaltyRequired: r.loyalty_required,
      source: r.source,
      matchMethod: r.match_method,
      matchConfidence: r.match_confidence,
      needsReview: false,
      isVerified: r.is_verified,
      observedAt: r.observed_at,
      externalRef: r.external_ref,
    };
  });
}

export async function getRetailersWithMonitorIds(): Promise<
  { id: string; slug: string; name: string; monitor_network_id: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retailers")
    .select("id, slug, name, monitor_network_id")
    .eq("is_active", true)
    .order("name");
  if (error) fail("retailers", error.message);
  return (data ?? []) as { id: string; slug: string; name: string; monitor_network_id: string | null }[];
}
