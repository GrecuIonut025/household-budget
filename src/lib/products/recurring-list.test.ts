import { describe, expect, it } from "vitest";
import { purchase } from "./fixtures";
import { pickRecurringItems, typicalQuantity } from "./recurring-list";
import type { ProductRow } from "./types";

type C = Parameters<typeof pickRecurringItems>[0][number];
const product = (id: string, o: Partial<C> = {}): C => ({
  id,
  unit: "pcs",
  is_archived: false,
  is_favorite: false,
  is_frequent: false,
  last_purchase_date: null,
  purchase_count: 0,
  ...o,
});

describe("typicalQuantity", () => {
  it("uses the median, whole numbers for countable units", () => {
    expect(typicalQuantity("pcs", [1, 2, 6])).toBe(2);
    expect(typicalQuantity("pack", [0.4])).toBe(1);
    expect(typicalQuantity("kg" as ProductRow["unit"], [0.5, 1.25])).toBe(0.875);
    expect(typicalQuantity("pcs", [])).toBe(1);
  });
});

describe("pickRecurringItems", () => {
  const today = "2026-11-07";
  it("keeps products bought twice within 180 days or flagged frequent, newest first", () => {
    const products = [
      product("milk", { last_purchase_date: "2026-11-01", purchase_count: 4 }),
      product("rice", { last_purchase_date: "2026-10-01", purchase_count: 2 }),
      product("old", { last_purchase_date: "2026-01-01", purchase_count: 2 }),
      product("once", { last_purchase_date: "2026-11-02", purchase_count: 1 }),
      product("salt", { is_frequent: true }),
      product("gone", { is_archived: true, is_frequent: true }),
    ];
    const history = [
      purchase({ product_id: "milk", purchased_on: "2026-11-01", quantity: 2, unit_price: 5 }),
      purchase({ product_id: "milk", purchased_on: "2026-10-20", quantity: 2, unit_price: 5 }),
      purchase({ product_id: "rice", purchased_on: "2026-10-01", quantity: 1, unit_price: 9 }),
      purchase({ product_id: "rice", purchased_on: "2026-09-01", quantity: 1, unit_price: 9 }),
      purchase({ product_id: "old", purchased_on: "2026-01-01", quantity: 1, unit_price: 9 }),
      purchase({ product_id: "old", purchased_on: "2026-01-02", quantity: 1, unit_price: 9 }),
      purchase({ product_id: "once", purchased_on: "2026-11-02", quantity: 1, unit_price: 9 }),
    ];
    expect(pickRecurringItems(products, history, today)).toEqual([
      { productId: "milk", quantity: 2 },
      { productId: "rice", quantity: 1 },
      { productId: "salt", quantity: 1 },
    ]);
  });

  it("respects the limit and returns nothing for an empty catalogue", () => {
    expect(pickRecurringItems([], [], today)).toEqual([]);
    expect(pickRecurringItems([product("a", { is_frequent: true }), product("b", { is_frequent: true })], [], today, 1)).toHaveLength(1);
  });
});
