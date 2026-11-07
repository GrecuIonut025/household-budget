import { describe, expect, it } from "vitest";
import { purchase } from "./fixtures";
import { computeProductStats, lineTotalMinor } from "./stats";

// Same scenario as supabase/tests/database/04-product-stats.test.sql.
describe("computeProductStats", () => {
  it("returns empty statistics without purchases", () => {
    expect(computeProductStats([])).toEqual({
      purchaseCount: 0,
      totalQuantity: 0,
      totalSpent: 0,
      avgPrice: null,
      minPrice: null,
      maxPrice: null,
      lastPrice: null,
      lastPurchaseDate: null,
      lastRetailerId: null,
    });
  });

  it("initialises from a first purchase", () => {
    const s = computeProductStats([purchase({ product_id: "p", purchased_on: "2026-01-10", quantity: 2, unit_price: 5, retailer_id: "lidl" })]);
    expect(s).toMatchObject({ purchaseCount: 1, totalQuantity: 2, totalSpent: 1000, avgPrice: 500, minPrice: 500, maxPrice: 500, lastPrice: 500, lastPurchaseDate: "2026-01-10", lastRetailerId: "lidl" });
  });

  it("aggregates several purchases and ignores backdated rows for last_*", () => {
    const s = computeProductStats([
      purchase({ product_id: "p", purchased_on: "2026-01-10", quantity: 2, unit_price: 5, retailer_id: "lidl" }),
      purchase({ product_id: "p", purchased_on: "2026-01-20", quantity: 1, unit_price: 7.5, retailer_id: "kaufland" }),
      purchase({ product_id: "p", purchased_on: "2026-01-05", quantity: 3, unit_price: 4, retailer_id: "penny" }),
    ]);
    expect(s.purchaseCount).toBe(3);
    expect(s.totalQuantity).toBe(6);
    expect(s.totalSpent).toBe(2950);
    expect(s.avgPrice).toBeCloseTo(491.6667, 4);
    expect(s.minPrice).toBe(400);
    expect(s.maxPrice).toBe(750);
    expect(s.lastPrice).toBe(750);
    expect(s.lastPurchaseDate).toBe("2026-01-20");
    expect(s.lastRetailerId).toBe("kaufland");
  });

  it("recomputes after a purchase is removed", () => {
    const s = computeProductStats([
      purchase({ product_id: "p", purchased_on: "2026-01-10", quantity: 2, unit_price: 5 }),
      purchase({ product_id: "p", purchased_on: "2026-01-05", quantity: 3, unit_price: 4 }),
    ]);
    expect(s).toMatchObject({ purchaseCount: 2, totalQuantity: 5, totalSpent: 2200, maxPrice: 500, lastPrice: 500, lastPurchaseDate: "2026-01-10" });
    expect(s.avgPrice).toBe(440);
  });

  it("breaks same-day ties by creation time", () => {
    const s = computeProductStats([
      purchase({ product_id: "p", purchased_on: "2026-02-01", quantity: 1, unit_price: 3, created_at: "2026-02-01T08:00:00Z" }),
      purchase({ product_id: "p", purchased_on: "2026-02-01", quantity: 1, unit_price: 9, created_at: "2026-02-01T18:00:00Z" }),
    ]);
    expect(s.lastPrice).toBe(900);
  });
});

describe("lineTotalMinor", () => {
  it("rounds per row like the database generated column", () => {
    expect(lineTotalMinor(0.333, 3.99)).toBe(133);
    expect(lineTotalMinor(2.5, 1.99)).toBe(498);
    expect(lineTotalMinor(3, 4.5)).toBe(1350);
  });
});
