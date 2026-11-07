import { describe, expect, it } from "vitest";
import { buildComparison, potentialSaving, quoteNeedsReview } from "./compare";
import type { ComparisonQuote } from "./types";

const q = (over: Partial<ComparisonQuote>): ComparisonQuote => ({
  productId: "p1",
  retailerId: "r1",
  retailerSlug: "lidl",
  retailerName: "Lidl",
  price: 5,
  currency: "RON",
  unitPrice: null,
  unitLabel: null,
  isPromo: false,
  loyaltyRequired: false,
  source: "adapter",
  matchMethod: "name",
  matchConfidence: 0.9,
  needsReview: false,
  isVerified: false,
  observedAt: "2026-11-07T10:00:00.000Z",
  externalRef: "monitor:1",
  ...over,
});

describe("buildComparison", () => {
  it("ranks quotes and drops non-positive prices", () => {
    const rows = buildComparison(
      [{ id: "p1", name: "Milk", brand: "Pilos" }],
      [
        q({ retailerId: "r2", retailerSlug: "penny", retailerName: "Penny", price: 6.5 }),
        q({ price: 4.2 }),
        q({ price: 0, retailerId: "r3" }),
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].cheapest?.price).toBe(4.2);
    expect(rows[0].quotes).toHaveLength(2);
    expect(rows[0].spread).toBe(2.3);
  });

  it("flags uncertain adapter matches for review", () => {
    expect(quoteNeedsReview(q({ matchConfidence: 0.7 }))).toBe(true);
    expect(quoteNeedsReview(q({ matchConfidence: 0.9 }))).toBe(false);
    expect(quoteNeedsReview(q({ source: "manual", matchConfidence: null }))).toBe(false);
  });
});

describe("potentialSaving", () => {
  it("returns positive delta only", () => {
    expect(potentialSaving(6, 4.5)).toBe(1.5);
    expect(potentialSaving(4, 4.5)).toBeNull();
  });
});
