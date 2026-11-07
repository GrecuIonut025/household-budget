import { describe, expect, it } from "vitest";
import { evaluateAlerts } from "./alerts";
import type { ComparisonQuote, PriceAlertRow } from "./types";

const alert = (over: Partial<PriceAlertRow> = {}): PriceAlertRow => ({
  id: "a1",
  productId: "p1",
  retailerId: null,
  direction: "below",
  targetPrice: 5,
  isActive: true,
  lastTriggeredAt: null,
  lastTriggeredPrice: null,
  ...over,
});

const quote = (over: Partial<ComparisonQuote> = {}): ComparisonQuote => ({
  productId: "p1",
  retailerId: "r1",
  retailerSlug: "lidl",
  retailerName: "Lidl",
  price: 4.5,
  currency: "RON",
  unitPrice: null,
  unitLabel: null,
  isPromo: false,
  loyaltyRequired: false,
  source: "manual",
  matchMethod: "manual",
  matchConfidence: 1,
  needsReview: false,
  isVerified: true,
  observedAt: "2026-11-07T10:00:00.000Z",
  externalRef: null,
  ...over,
});

describe("evaluateAlerts", () => {
  it("fires below/above alerts", () => {
    expect(evaluateAlerts([alert()], [quote()])).toHaveLength(1);
    expect(evaluateAlerts([alert({ direction: "above", targetPrice: 4 })], [quote({ price: 4.5 })])).toHaveLength(1);
    expect(evaluateAlerts([alert({ direction: "above", targetPrice: 5 })], [quote({ price: 4.5 })])).toHaveLength(0);
  });

  it("respects retailer filter and inactive flag", () => {
    expect(evaluateAlerts([alert({ retailerId: "r2" })], [quote()])).toHaveLength(0);
    expect(evaluateAlerts([alert({ isActive: false })], [quote()])).toHaveLength(0);
  });
});
