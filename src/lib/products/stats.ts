import { toMinor, type Minor } from "@/lib/money";
import type { PurchaseRow } from "./types";

export interface ProductStats {
  purchaseCount: number;
  totalQuantity: number;
  totalSpent: Minor;
  /** average price per unit bought (total spent / total quantity), minor units, null without purchases */
  avgPrice: number | null;
  minPrice: Minor | null;
  maxPrice: Minor | null;
  lastPrice: Minor | null;
  lastPurchaseDate: string | null;
  lastRetailerId: string | null;
}

type StatsInput = Pick<PurchaseRow, "id" | "purchased_on" | "quantity" | "unit_price" | "retailer_id" | "created_at">;

/** Same ordering the database uses to pick the "last" purchase: date, then creation time, then id. */
export function compareNewestFirst(a: StatsInput, b: StatsInput): number {
  return (
    b.purchased_on.localeCompare(a.purchased_on) ||
    b.created_at.localeCompare(a.created_at) ||
    b.id.localeCompare(a.id)
  );
}

/** Line total in minor units, rounded per row like the generated `total_price` column. */
export function lineTotalMinor(quantity: number, unitPrice: number): Minor {
  return Math.round(Number((quantity * toMinor(unitPrice)).toFixed(6)));
}

/**
 * Pure mirror of `recompute_product_stats()`. The database remains the source of truth for the numbers shown on
 * the product page; this exists for per-member and per-period views and is tested against the same scenario.
 */
export function computeProductStats(purchases: readonly StatsInput[]): ProductStats {
  if (purchases.length === 0) {
    return {
      purchaseCount: 0,
      totalQuantity: 0,
      totalSpent: 0,
      avgPrice: null,
      minPrice: null,
      maxPrice: null,
      lastPrice: null,
      lastPurchaseDate: null,
      lastRetailerId: null,
    };
  }
  const newest = [...purchases].sort(compareNewestFirst)[0];
  const totalQuantity = purchases.reduce((s, p) => s + p.quantity, 0);
  const totalSpent = purchases.reduce((s, p) => s + lineTotalMinor(p.quantity, p.unit_price), 0);
  const prices = purchases.map((p) => toMinor(p.unit_price));
  return {
    purchaseCount: purchases.length,
    totalQuantity: Number(totalQuantity.toFixed(3)),
    totalSpent,
    avgPrice: totalQuantity > 0 ? totalSpent / totalQuantity : null,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    lastPrice: toMinor(newest.unit_price),
    lastPurchaseDate: newest.purchased_on,
    lastRetailerId: newest.retailer_id,
  };
}
