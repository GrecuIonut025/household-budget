import { describe, expect, it } from "vitest";
import { matchOffer, manualMatch } from "./matching";
import type { AdapterOffer, MatchCandidate } from "./types";

const baseOffer = (over: Partial<AdapterOffer> = {}): AdapterOffer => ({
  adapter: "monitor",
  retailerSlug: "lidl",
  externalRef: "monitor:1",
  nameRaw: "Pilos Lapte UHT 1.5% 1L",
  brandRaw: "Pilos",
  unitRaw: "1l",
  categoryRaw: "Lapte UHT",
  price: 4.39,
  currency: "RON",
  isPromo: false,
  loyaltyRequired: false,
  gtin: null,
  observedAt: "2026-11-07T10:00:00.000Z",
  sourceUrl: null,
  storeExternalId: null,
  storeName: null,
  ...over,
});

const candidates: MatchCandidate[] = [
  {
    productId: "p1",
    name: "Pilos Lapte UHT 1,5%",
    brand: "Pilos",
    barcodes: ["4006381333931"],
    packageSize: 1,
    packageUnit: "l",
    category: "dairy",
    preferredRetailerSlug: "lidl",
  },
  {
    productId: "p2",
    name: "K-Classic Milk 1L",
    brand: "K-Classic",
    barcodes: [],
    packageSize: 1,
    packageUnit: "l",
    category: "dairy",
    preferredRetailerSlug: "kaufland",
  },
];

describe("matchOffer", () => {
  it("matches EAN first at high confidence", () => {
    const decision = matchOffer(baseOffer({ gtin: "4006381333931", nameRaw: "Something else" }), candidates);
    expect(decision.productId).toBe("p1");
    expect(decision.method).toBe("barcode");
    expect(decision.confidence).toBeGreaterThanOrEqual(0.99);
    expect(decision.needsReview).toBe(false);
  });

  it("reuses a prior adapter link", () => {
    const decision = matchOffer(baseOffer(), candidates, { priorProductId: "p1" });
    expect(decision.method).toBe("adapter_ref");
    expect(decision.productId).toBe("p1");
  });

  it("auto-links a strong name/brand/size match", () => {
    const decision = matchOffer(baseOffer(), candidates);
    expect(decision.productId).toBe("p1");
    expect(decision.confidence).toBeGreaterThanOrEqual(0.75);
    expect(decision.needsReview).toBe(false);
  });

  it("does not invent a match for unrelated private labels across retailers", () => {
    const decision = matchOffer(
      baseOffer({ retailerSlug: "lidl", nameRaw: "Pilos Lapte 1L", brandRaw: "Pilos", gtin: null }),
      [candidates[1]],
    );
    expect(decision.productId).toBeNull();
  });

  it("never links when confidence is too low", () => {
    const decision = matchOffer(baseOffer({ nameRaw: "Zahăr cristal 1kg", brandRaw: null }), candidates);
    expect(decision.productId).toBeNull();
    expect(decision.needsReview).toBe(true);
  });
});

describe("manualMatch", () => {
  it("is always verified", () => {
    expect(manualMatch("p1")).toEqual({
      productId: "p1",
      method: "manual",
      confidence: 1,
      needsReview: false,
      reason: "user entered",
      parts: null,
    });
  });
});
