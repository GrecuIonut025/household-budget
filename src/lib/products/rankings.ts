import { addDays } from "@/lib/dates";
import { toMinor, type Minor } from "@/lib/money";
import { lineTotalMinor } from "./stats";
import type { PriceRow, ProductRow, PurchaseRow } from "./types";

export const RECURRING_MIN_PURCHASES = 2;
export const SAVINGS_WINDOW_DAYS = 90;
/** Quotes older than this are not trusted to claim a saving. */
export const PRICE_STALE_DAYS = 60;

type RankedProduct = Pick<
  ProductRow,
  "id" | "purchase_count" | "total_quantity" | "total_spent" | "avg_price" | "last_price" | "is_archived"
>;
type RankedPurchase = Pick<PurchaseRow, "product_id" | "purchased_on" | "quantity" | "unit_price" | "purchased_by" | "retailer_id" | "created_at" | "id">;

function byName(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id);
}

export interface MostPurchasedEntry {
  productId: string;
  purchaseCount: number;
  totalQuantity: number;
  totalSpent: Minor;
}

export function mostPurchased(products: readonly RankedProduct[], limit = 10): MostPurchasedEntry[] {
  return products
    .filter((p) => !p.is_archived && p.purchase_count > 0)
    .map((p) => ({
      productId: p.id,
      purchaseCount: p.purchase_count,
      totalQuantity: Number(p.total_quantity),
      totalSpent: toMinor(p.total_spent),
    }))
    .sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpent - a.totalSpent || a.productId.localeCompare(b.productId))
    .slice(0, limit);
}

export interface ExpensiveRecurringEntry {
  productId: string;
  purchaseCount: number;
  /** average price paid per unit, minor units */
  avgPrice: number;
  totalSpent: Minor;
}

/** Items bought repeatedly, ranked by the average price paid per unit. */
export function mostExpensiveRecurring(products: readonly RankedProduct[], limit = 10): ExpensiveRecurringEntry[] {
  return products
    .filter((p) => !p.is_archived && p.purchase_count >= RECURRING_MIN_PURCHASES && p.avg_price !== null)
    .map((p) => ({
      productId: p.id,
      purchaseCount: p.purchase_count,
      avgPrice: toMinor(Number(p.avg_price)),
      totalSpent: toMinor(p.total_spent),
    }))
    .sort((a, b) => b.avgPrice - a.avgPrice || b.totalSpent - a.totalSpent || a.productId.localeCompare(b.productId))
    .slice(0, limit);
}

export interface PriceIncreaseEntry {
  productId: string;
  /** quantity-weighted average of every earlier purchase, minor units per unit */
  baseline: number;
  /** unit price of the most recent purchase, minor units */
  latest: Minor;
  change: number;
  changePct: number;
  latestDate: string;
}

/**
 * Compares the latest unit price with the quantity-weighted average of the purchases before it. Needs at least
 * two purchases; only increases are reported.
 */
export function highestPriceIncreases(purchases: readonly RankedPurchase[], limit = 10): PriceIncreaseEntry[] {
  const byProduct = new Map<string, RankedPurchase[]>();
  for (const p of purchases) {
    const list = byProduct.get(p.product_id);
    if (list) list.push(p);
    else byProduct.set(p.product_id, [p]);
  }
  const entries: PriceIncreaseEntry[] = [];
  for (const [productId, rows] of byProduct) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort(
      (a, b) => a.purchased_on.localeCompare(b.purchased_on) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
    const latest = sorted[sorted.length - 1];
    const earlier = sorted.slice(0, -1);
    const quantity = earlier.reduce((s, p) => s + p.quantity, 0);
    if (quantity <= 0) continue;
    const baseline = earlier.reduce((s, p) => s + lineTotalMinor(p.quantity, p.unit_price), 0) / quantity;
    const latestMinor = toMinor(latest.unit_price);
    const change = latestMinor - baseline;
    if (baseline <= 0 || change <= 0) continue;
    entries.push({ productId, baseline, latest: latestMinor, change, changePct: change / baseline, latestDate: latest.purchased_on });
  }
  return entries
    .sort((a, b) => b.changePct - a.changePct || b.change - a.change || a.productId.localeCompare(b.productId))
    .slice(0, limit);
}

export interface PotentialSavingEntry {
  productId: string;
  retailerId: string;
  paidPrice: Minor;
  cheapestPrice: Minor;
  perUnit: Minor;
  /** quantity bought inside the window, used to scale the saving */
  recentQuantity: number;
  total: Minor;
  isPromo: boolean;
  observedAt: string;
}

/**
 * Compares what the household last paid with the cheapest fresh quote in `product_prices`, scaled by what it
 * actually bought in the last 90 days. Returns an empty list when there are no prices, so the UI can say so
 * instead of inventing savings.
 */
export function greatestPotentialSavings(
  products: readonly RankedProduct[],
  prices: readonly PriceRow[],
  purchases: readonly RankedPurchase[],
  opts: { today: string; currency: string; limit?: number },
): PotentialSavingEntry[] {
  const windowStart = addDays(opts.today, -SAVINGS_WINDOW_DAYS);
  const staleBefore = addDays(opts.today, -PRICE_STALE_DAYS);

  const recentQuantity = new Map<string, number>();
  for (const p of purchases) {
    if (p.purchased_on >= windowStart) recentQuantity.set(p.product_id, (recentQuantity.get(p.product_id) ?? 0) + p.quantity);
  }

  const cheapest = new Map<string, PriceRow>();
  for (const price of prices) {
    if (price.currency !== opts.currency || price.observed_at.slice(0, 10) < staleBefore) continue;
    const current = cheapest.get(price.product_id);
    if (!current || toMinor(price.price) < toMinor(current.price)) cheapest.set(price.product_id, price);
  }

  const entries: PotentialSavingEntry[] = [];
  for (const product of products) {
    const quote = cheapest.get(product.id);
    const qty = recentQuantity.get(product.id) ?? 0;
    if (product.is_archived || !quote || product.last_price === null || qty <= 0) continue;
    const paid = toMinor(product.last_price);
    const best = toMinor(quote.price);
    if (best >= paid) continue;
    entries.push({
      productId: product.id,
      retailerId: quote.retailer_id,
      paidPrice: paid,
      cheapestPrice: best,
      perUnit: paid - best,
      recentQuantity: qty,
      total: Math.round((paid - best) * qty),
      isPromo: quote.is_promo,
      observedAt: quote.observed_at,
    });
  }
  return entries.sort((a, b) => b.total - a.total || a.productId.localeCompare(b.productId)).slice(0, opts.limit ?? 10);
}

export interface MemberTopProduct {
  productId: string;
  purchaseCount: number;
  totalQuantity: number;
  totalSpent: Minor;
}

export interface MemberRanking {
  /** null groups purchases that are not attributed to a member */
  userId: string | null;
  purchaseCount: number;
  totalSpent: Minor;
  top: MemberTopProduct[];
}

/** Most purchased products per household member (members with no purchases are omitted). */
export function mostPurchasedPerMember(purchases: readonly RankedPurchase[], topPerMember = 3): MemberRanking[] {
  const members = new Map<string | null, Map<string, MemberTopProduct>>();
  for (const p of purchases) {
    const products = members.get(p.purchased_by) ?? new Map<string, MemberTopProduct>();
    members.set(p.purchased_by, products);
    const entry = products.get(p.product_id) ?? { productId: p.product_id, purchaseCount: 0, totalQuantity: 0, totalSpent: 0 };
    entry.purchaseCount += 1;
    entry.totalQuantity = Number((entry.totalQuantity + p.quantity).toFixed(3));
    entry.totalSpent += lineTotalMinor(p.quantity, p.unit_price);
    products.set(p.product_id, entry);
  }
  const rankings: MemberRanking[] = [];
  for (const [userId, products] of members) {
    const all = [...products.values()];
    rankings.push({
      userId,
      purchaseCount: all.reduce((s, p) => s + p.purchaseCount, 0),
      totalSpent: all.reduce((s, p) => s + p.totalSpent, 0),
      top: all
        .sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpent - a.totalSpent || byName({ id: a.productId }, { id: b.productId }))
        .slice(0, topPerMember),
    });
  }
  return rankings.sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpent - a.totalSpent || String(a.userId).localeCompare(String(b.userId)));
}
