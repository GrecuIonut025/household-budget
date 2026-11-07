import { describe, expect, it } from "vitest";
import { purchase } from "./fixtures";
import {
  greatestPotentialSavings,
  highestPriceIncreases,
  mostExpensiveRecurring,
  mostPurchased,
  mostPurchasedPerMember,
} from "./rankings";
import type { PriceRow, ProductRow } from "./types";

type P = Pick<ProductRow, "id" | "purchase_count" | "total_quantity" | "total_spent" | "avg_price" | "last_price" | "is_archived">;
const product = (id: string, o: Partial<P> = {}): P => ({
  id,
  purchase_count: 0,
  total_quantity: 0,
  total_spent: 0,
  avg_price: null,
  last_price: null,
  is_archived: false,
  ...o,
});

describe("mostPurchased", () => {
  it("orders by purchase count, then spend, and skips unpurchased and archived products", () => {
    const rows = [
      product("milk", { purchase_count: 5, total_quantity: 5, total_spent: 25 }),
      product("bread", { purchase_count: 5, total_quantity: 5, total_spent: 30 }),
      product("rice", { purchase_count: 2, total_spent: 10 }),
      product("never"),
      product("old", { purchase_count: 9, total_spent: 90, is_archived: true }),
    ];
    expect(mostPurchased(rows).map((e) => e.productId)).toEqual(["bread", "milk", "rice"]);
    expect(mostPurchased(rows, 1)).toHaveLength(1);
    expect(mostPurchased(rows)[0]).toMatchObject({ purchaseCount: 5, totalSpent: 3000 });
  });

  it("is empty without purchases", () => {
    expect(mostPurchased([product("a")])).toEqual([]);
  });
});

describe("mostExpensiveRecurring", () => {
  it("needs two purchases and ranks by average price per unit", () => {
    const rows = [
      product("coffee", { purchase_count: 3, total_spent: 90, avg_price: 30 }),
      product("steak", { purchase_count: 1, total_spent: 80, avg_price: 80 }),
      product("cheese", { purchase_count: 2, total_spent: 50, avg_price: 25 }),
    ];
    expect(mostExpensiveRecurring(rows).map((e) => [e.productId, e.avgPrice])).toEqual([
      ["coffee", 3000],
      ["cheese", 2500],
    ]);
  });
});

describe("highestPriceIncreases", () => {
  it("compares the latest price with the weighted average of earlier purchases", () => {
    const rows = [
      purchase({ product_id: "oil", purchased_on: "2026-01-01", quantity: 1, unit_price: 10 }),
      purchase({ product_id: "oil", purchased_on: "2026-02-01", quantity: 3, unit_price: 10 }),
      purchase({ product_id: "oil", purchased_on: "2026-03-01", quantity: 1, unit_price: 13 }),
      purchase({ product_id: "eggs", purchased_on: "2026-01-01", quantity: 1, unit_price: 20 }),
      purchase({ product_id: "eggs", purchased_on: "2026-03-01", quantity: 1, unit_price: 22 }),
      purchase({ product_id: "salt", purchased_on: "2026-01-01", quantity: 1, unit_price: 4 }),
      purchase({ product_id: "salt", purchased_on: "2026-03-01", quantity: 1, unit_price: 3 }),
      purchase({ product_id: "once", purchased_on: "2026-03-01", quantity: 1, unit_price: 3 }),
    ];
    const result = highestPriceIncreases(rows);
    expect(result.map((r) => r.productId)).toEqual(["oil", "eggs"]);
    expect(result[0]).toMatchObject({ baseline: 1000, latest: 1300, change: 300, latestDate: "2026-03-01" });
    expect(result[0].changePct).toBeCloseTo(0.3);
    expect(result[1].changePct).toBeCloseTo(0.1);
  });

  it("ignores input order and unchanged prices", () => {
    const rows = [
      purchase({ product_id: "a", purchased_on: "2026-03-01", quantity: 1, unit_price: 5 }),
      purchase({ product_id: "a", purchased_on: "2026-01-01", quantity: 1, unit_price: 5 }),
    ];
    expect(highestPriceIncreases(rows)).toEqual([]);
  });
});

describe("greatestPotentialSavings", () => {
  const today = "2026-11-07";
  const price = (product_id: string, retailer_id: string, p: number, o: Partial<PriceRow> = {}): PriceRow => ({
    product_id,
    retailer_id,
    price: p,
    currency: "RON",
    is_promo: false,
    observed_at: "2026-11-05T08:00:00Z",
    ...o,
  });
  const products = [product("milk", { last_price: 7 }), product("bread", { last_price: 4 }), product("rice", { last_price: 9 })];
  const history = [
    purchase({ product_id: "milk", purchased_on: "2026-11-01", quantity: 4, unit_price: 7 }),
    purchase({ product_id: "bread", purchased_on: "2026-10-20", quantity: 2, unit_price: 4 }),
    purchase({ product_id: "rice", purchased_on: "2026-01-01", quantity: 5, unit_price: 9 }),
  ];

  it("returns nothing when no prices exist (honest empty state)", () => {
    expect(greatestPotentialSavings(products, [], history, { today, currency: "RON" })).toEqual([]);
  });

  it("scales the per-unit saving by recent quantity and picks the cheapest quote", () => {
    const prices = [price("milk", "lidl", 6), price("milk", "penny", 5.5, { is_promo: true }), price("bread", "lidl", 4.5)];
    const result = greatestPotentialSavings(products, prices, history, { today, currency: "RON" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ productId: "milk", retailerId: "penny", perUnit: 150, recentQuantity: 4, total: 600, isPromo: true });
  });

  it("skips stale quotes, other currencies and products not bought recently", () => {
    const prices = [
      price("milk", "lidl", 1, { observed_at: "2026-08-01T00:00:00Z" }),
      price("bread", "lidl", 1, { currency: "EUR" }),
      price("rice", "lidl", 1),
    ];
    expect(greatestPotentialSavings(products, prices, history, { today, currency: "RON" })).toEqual([]);
  });
});

describe("mostPurchasedPerMember", () => {
  it("groups by member, keeps unattributed purchases and limits the top list", () => {
    const rows = [
      purchase({ product_id: "milk", purchased_on: "2026-11-01", quantity: 1, unit_price: 5, purchased_by: "ana" }),
      purchase({ product_id: "milk", purchased_on: "2026-11-02", quantity: 2, unit_price: 5, purchased_by: "ana" }),
      purchase({ product_id: "bread", purchased_on: "2026-11-02", quantity: 1, unit_price: 4, purchased_by: "ana" }),
      purchase({ product_id: "beer", purchased_on: "2026-11-02", quantity: 6, unit_price: 3, purchased_by: "ion" }),
      purchase({ product_id: "eggs", purchased_on: "2026-11-02", quantity: 1, unit_price: 9 }),
    ];
    const result = mostPurchasedPerMember(rows, 1);
    expect(result.map((m) => m.userId)).toEqual(["ana", "ion", null]);
    expect(result[0].top).toEqual([{ productId: "milk", purchaseCount: 2, totalQuantity: 3, totalSpent: 1500 }]);
    expect(result[0]).toMatchObject({ purchaseCount: 3, totalSpent: 1900 });
  });

  it("is empty without purchases", () => {
    expect(mostPurchasedPerMember([])).toEqual([]);
  });
});
