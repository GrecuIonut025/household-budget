import type { PurchaseRow } from "./types";

let seq = 0;

export function purchase(overrides: Partial<PurchaseRow> & Pick<PurchaseRow, "product_id" | "purchased_on" | "quantity" | "unit_price">): PurchaseRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    retailer_id: null,
    transaction_id: null,
    total_price: Math.round(overrides.quantity * overrides.unit_price * 100) / 100,
    is_promo: false,
    purchased_by: null,
    created_at: `2026-11-01T10:00:${String(seq % 60).padStart(2, "0")}Z`,
    ...overrides,
  };
}
