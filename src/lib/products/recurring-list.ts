import { addDays } from "@/lib/dates";
import type { ProductRow, PurchaseRow } from "./types";

export const RECURRING_WINDOW_DAYS = 180;
export const RECURRING_MAX_ITEMS = 50;

export interface RecurringItem {
  productId: string;
  quantity: number;
}

type Candidate = Pick<ProductRow, "id" | "unit" | "is_archived" | "is_favorite" | "is_frequent" | "last_purchase_date" | "purchase_count">;
type History = Pick<PurchaseRow, "product_id" | "purchased_on" | "quantity">;

function append(map: Map<string, number[]>, key: string, value: number): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Whole numbers for countable units, up to three decimals for weights and volumes; never below the minimum step. */
export function typicalQuantity(unit: ProductRow["unit"], quantities: number[]): number {
  if (quantities.length === 0) return 1;
  const m = median(quantities);
  if (unit === "pcs" || unit === "pack") return Math.max(1, Math.round(m));
  return Math.max(0.001, Number(m.toFixed(3)));
}

/**
 * Products to restock: bought at least twice in the last 180 days, or flagged as frequently purchased.
 * Quantity is the median amount bought per purchase. Most recently bought first.
 */
export function pickRecurringItems(
  products: readonly Candidate[],
  history: readonly History[],
  today: string,
  limit = RECURRING_MAX_ITEMS,
): RecurringItem[] {
  const since = addDays(today, -RECURRING_WINDOW_DAYS);
  const recent = new Map<string, number[]>();
  const all = new Map<string, number[]>();
  for (const h of history) {
    append(all, h.product_id, h.quantity);
    if (h.purchased_on >= since) append(recent, h.product_id, h.quantity);
  }
  return products
    .filter((p) => !p.is_archived && ((recent.get(p.id)?.length ?? 0) >= 2 || p.is_frequent))
    .sort(
      (a, b) =>
        (b.last_purchase_date ?? "").localeCompare(a.last_purchase_date ?? "") ||
        b.purchase_count - a.purchase_count ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit)
    .map((p) => ({ productId: p.id, quantity: typicalQuantity(p.unit, recent.get(p.id) ?? all.get(p.id) ?? []) }));
}
