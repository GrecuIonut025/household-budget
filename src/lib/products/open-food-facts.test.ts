import { describe, expect, it, vi } from "vitest";
import { fetchOpenFoodFacts, parseOffQuantity, parseOffResponse } from "./open-food-facts";
import { createRateLimiter, createTtlCache } from "./throttle";

const BARCODE = "5901234123457";

describe("parseOffQuantity", () => {
  it("parses simple single-pack quantities and converts cl/dl", () => {
    expect(parseOffQuantity("500 g")).toEqual({ size: 500, unit: "g" });
    expect(parseOffQuantity("1,5 L")).toEqual({ size: 1.5, unit: "l" });
    expect(parseOffQuantity("33cl")).toEqual({ size: 330, unit: "ml" });
    expect(parseOffQuantity("2 dl")).toEqual({ size: 200, unit: "ml" });
    expect(parseOffQuantity("0.75 kg")).toEqual({ size: 0.75, unit: "kg" });
  });

  it("does not guess for multi-packs or free text", () => {
    expect(parseOffQuantity("6 x 125 g")).toBeNull();
    expect(parseOffQuantity("one bottle")).toBeNull();
    expect(parseOffQuantity("0 g")).toBeNull();
    expect(parseOffQuantity(undefined)).toBeNull();
  });
});

describe("parseOffResponse", () => {
  it("extracts name, first brand and quantity", () => {
    const json = { status: 1, product: { product_name: "Yogurt", product_name_ro: "Iaurt", brands: "Danone, Activia", quantity: "400 g" } };
    expect(parseOffResponse(json, BARCODE)).toEqual({
      barcode: BARCODE,
      name: "Iaurt",
      brand: "Danone",
      packageSize: 400,
      packageUnit: "g",
      sourceUrl: `https://world.openfoodfacts.org/product/${BARCODE}`,
    });
    expect(parseOffResponse(json, BARCODE, "en")?.name).toBe("Yogurt");
  });

  it("returns only what exists and never invents fields", () => {
    const p = parseOffResponse({ status: 1, product: { product_name: "Mystery" } }, BARCODE);
    expect(p).toMatchObject({ name: "Mystery", brand: null, packageSize: null, packageUnit: null });
  });

  it("treats unknown products and nameless entries as not usable", () => {
    expect(parseOffResponse({ status: 0 }, BARCODE)).toBeNull();
    expect(parseOffResponse({ status: 1, product: { brands: "X" } }, BARCODE)).toBeNull();
    expect(parseOffResponse(null, BARCODE)).toBeNull();
  });
});

describe("fetchOpenFoodFacts", () => {
  const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("rejects invalid barcodes without a network call", async () => {
    const fetchImpl = ok({});
    expect(await fetchOpenFoodFacts("123", { fetchImpl, userAgent: "t" })).toEqual({ status: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends a User-Agent and maps responses", async () => {
    const fetchImpl = ok({ status: 1, product: { product_name: "Iaurt" } });
    const result = await fetchOpenFoodFacts(BARCODE, { fetchImpl, userAgent: "HouseholdBudget/0.1" });
    expect(result.status).toBe("found");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/api/v2/product/${BARCODE}.json`);
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("HouseholdBudget/0.1");
  });

  it("maps 404, 429, server errors and network failures", async () => {
    expect(await fetchOpenFoodFacts(BARCODE, { fetchImpl: ok({}, 404), userAgent: "t" })).toEqual({ status: "not_found" });
    expect(await fetchOpenFoodFacts(BARCODE, { fetchImpl: ok({}, 429), userAgent: "t" })).toEqual({ status: "rate_limited" });
    expect(await fetchOpenFoodFacts(BARCODE, { fetchImpl: ok({}, 503), userAgent: "t" })).toEqual({ status: "unavailable" });
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await fetchOpenFoodFacts(BARCODE, { fetchImpl: failing, userAgent: "t" })).toEqual({ status: "unavailable" });
  });
});

describe("throttle", () => {
  it("expires cache entries and evicts the oldest when full", () => {
    let now = 0;
    const cache = createTtlCache<string>(1000, 2, { now: () => now });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe("3");
    now = 1500;
    expect(cache.get("c")).toBeUndefined();
  });

  it("limits hits per key inside a sliding window", () => {
    let now = 0;
    const limiter = createRateLimiter(2, 1000, { now: () => now });
    expect(limiter.take("u")).toBe(true);
    expect(limiter.take("u")).toBe(true);
    expect(limiter.take("u")).toBe(false);
    expect(limiter.take("other")).toBe(true);
    now = 1001;
    expect(limiter.take("u")).toBe(true);
  });
});
