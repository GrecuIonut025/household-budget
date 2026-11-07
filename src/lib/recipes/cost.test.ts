import { describe, expect, it } from "vitest";
import { computeRecipeCost, type IngredientInput } from "./cost";
import { lookupPricing, priceBasisFromProduct, type PricingLookup, type PricingMap, type ProductPricing, type RetailerQuote } from "./pricing";
import { formatQuantity, scaleFactor, scaleQuantity, SERVING_PRESETS } from "./scaling";

const LIDL = "r-lidl";
const KAUFLAND = "r-kaufland";
const CARREFOUR = "r-carrefour";
const name: Record<string, string> = { [LIDL]: "Lidl", [KAUFLAND]: "Kaufland", [CARREFOUR]: "Carrefour" };

const quote = (retailerId: string, price: number, extra: Partial<RetailerQuote> = {}): RetailerQuote => ({
  retailerId,
  retailerName: name[retailerId],
  priceMinor: Math.round(price * 100),
  isPromo: false,
  observedAt: "2026-11-06T08:00:00Z",
  ...extra,
});

// Fixture prices (RON). Pasta 500 g, eggs x10, parmesan 200 g, pancetta 150 g.
const pricing: PricingMap = {
  pasta: {
    productId: "pasta",
    basis: { quantity: 500, unit: "g" },
    spec: {},
    quotes: [quote(LIDL, 4.99), quote(KAUFLAND, 5.49), quote(CARREFOUR, 4.79)],
    lastPurchase: null,
  },
  eggs: {
    productId: "eggs",
    basis: { quantity: 10, unit: "pcs" },
    spec: { unitWeightG: 60 },
    quotes: [quote(LIDL, 12.9), quote(KAUFLAND, 13.5)],
    lastPurchase: null,
  },
  parmesan: {
    productId: "parmesan",
    basis: { quantity: 200, unit: "g" },
    spec: {},
    quotes: [quote(LIDL, 21.99), quote(CARREFOUR, 24.5), quote(KAUFLAND, 22.9)],
    lastPurchase: null,
  },
  pancetta: {
    productId: "pancetta",
    basis: { quantity: 150, unit: "g" },
    spec: {},
    quotes: [quote(KAUFLAND, 8.99), quote(LIDL, 9.49)],
    lastPurchase: null,
  },
};

const ing = (id: string, productId: string | null, quantity: number | null, unit: IngredientInput["unit"], extra: Partial<IngredientInput> = {}): IngredientInput => ({
  id,
  name: id,
  productId,
  quantity,
  unit,
  isOptional: false,
  isAtHome: false,
  substitutions: [],
  ...extra,
});

const carbonara = [
  ing("Pasta", "pasta", 200, "g"),
  ing("Eggs", "eggs", 2, "pcs"),
  ing("Parmesan", "parmesan", 80, "g"),
  ing("Pancetta", "pancetta", 100, "g"),
];

const cost = (servings: number, over: Partial<Parameters<typeof computeRecipeCost>[0]> = {}) =>
  computeRecipeCost({ baseServings: 2, targetServings: servings, ingredients: carbonara, pricing, ...over });

const line = (c: ReturnType<typeof cost>, id: string) => c.lines.find((l) => l.id === id)!;

describe("Pasta Carbonara scenario (2 servings)", () => {
  const c = cost(2);

  it("prices every ingredient at its cheapest retailer", () => {
    expect(line(c, "Pasta").cost).toMatchObject({ minor: 192, source: { kind: "retailer", retailerName: "Carrefour" } });
    expect(line(c, "Eggs").cost).toMatchObject({ minor: 258, source: { retailerName: "Lidl" } });
    expect(line(c, "Parmesan").cost).toMatchObject({ minor: 880, source: { retailerName: "Lidl" } });
    expect(line(c, "Pancetta").cost).toMatchObject({ minor: 599, source: { retailerName: "Kaufland" } });
  });

  it("totals the recipe and divides by servings", () => {
    expect(c.totalMinor).toBe(1929);
    expect(c.perServingMinor).toBe(965);
    expect(c.toBuyMinor).toBe(1929);
    expect(c.complete).toBe(true);
    expect(c.unknownCount).toBe(0);
    expect(c.usesLastPurchase).toBe(false);
  });

  it("lists retailer options cheapest first", () => {
    expect(line(c, "Parmesan").options.map((o) => [o.retailerName, o.minor])).toEqual([
      ["Lidl", 880],
      ["Kaufland", 916],
      ["Carrefour", 980],
    ]);
  });

  it("estimates savings versus the dearest retailer", () => {
    expect(line(c, "Pasta").savingsMinor).toBe(28);
    expect(line(c, "Eggs").savingsMinor).toBe(12);
    expect(line(c, "Parmesan").savingsMinor).toBe(100);
    expect(line(c, "Pancetta").savingsMinor).toBe(34);
    expect(c.savingsMinor).toBe(174);
  });

  it("compares single-retailer baskets", () => {
    expect(c.cheapestMixedMinor).toBe(1929);
    expect(c.baskets.map((b) => [b.retailerName, b.totalMinor])).toEqual([
      ["Lidl", 1971],
      ["Kaufland", 2005],
    ]);
    expect(c.partialBaskets).toEqual([{ retailerId: CARREFOUR, retailerName: "Carrefour", totalMinor: 1172, missingCount: 2 }]);
  });
});

describe("scaling to 2 / 4 / 6 / 8 servings", () => {
  it("scales quantities", () => {
    const quantities = (s: number) => cost(s).lines.map((l) => l.quantity);
    expect(quantities(2)).toEqual([200, 2, 80, 100]);
    expect(quantities(4)).toEqual([400, 4, 160, 200]);
    expect(quantities(6)).toEqual([600, 6, 240, 300]);
    expect(quantities(8)).toEqual([800, 8, 320, 400]);
  });

  it("recalculates costs from the scaled quantities", () => {
    expect(SERVING_PRESETS).toEqual([2, 4, 6, 8]);
    expect(cost(4).totalMinor).toBe(383 + 516 + 1759 + 1199);
    expect(cost(6).totalMinor).toBe(575 + 774 + 2639 + 1798);
    expect(cost(8).totalMinor).toBe(766 + 1032 + 3518 + 2397);
  });

  it("keeps the per serving cost roughly constant", () => {
    const per = SERVING_PRESETS.map((s) => cost(s).perServingMinor!);
    expect(Math.max(...per) - Math.min(...per)).toBeLessThanOrEqual(1);
  });

  it("scales from a recipe written for a different base", () => {
    const c = computeRecipeCost({ baseServings: 4, targetServings: 2, ingredients: [ing("Pasta", "pasta", 400, "g")], pricing });
    expect(c.lines[0].quantity).toBe(200);
    expect(c.totalMinor).toBe(192);
  });

  it("supports non-preset servings and rejects invalid ones", () => {
    expect(cost(3).lines[1].quantity).toBe(3);
    expect(() => cost(0)).toThrow(RangeError);
    expect(() => computeRecipeCost({ baseServings: 0, targetServings: 2, ingredients: [], pricing })).toThrow(RangeError);
  });
});

describe("scaling helpers", () => {
  it("scales without floating point noise", () => {
    expect(scaleQuantity(0.1, 1, 3)).toBe(0.3);
    expect(scaleQuantity(200, 2, 8)).toBe(800);
    expect(scaleFactor(4, 6)).toBe(1.5);
  });

  it("formats amounts for the locale", () => {
    expect(formatQuantity(1.5, "en")).toBe("1.5");
    expect(formatQuantity(1.5, "ro")).toBe("1,5");
    expect(formatQuantity(0.3333, "en")).toBe("0.33");
  });
});

describe("missing prices are unknown, never invented", () => {
  it("marks an unpriced ingredient unknown and totals only what is known", () => {
    const c = cost(2, { pricing: { ...pricing, pancetta: { ...pricing.pancetta, quotes: [] } } });
    const l = line(c, "Pancetta");
    expect(l.cost).toBeNull();
    expect(l.unknownReason).toBe("no_price");
    expect(l.toBuyMinor).toBeNull();
    expect(c.totalMinor).toBe(192 + 258 + 880);
    expect(c.unknownCount).toBe(1);
    expect(c.complete).toBe(false);
  });

  it("reports unknown for products with no pricing row at all", () => {
    const { pancetta, ...rest } = pricing;
    void pancetta;
    const c = cost(2, { pricing: rest });
    expect(line(c, "Pancetta").unknownReason).toBe("no_price");
  });

  it("returns null totals when nothing can be priced", () => {
    const c = cost(2, { pricing: {} });
    expect(c.totalMinor).toBeNull();
    expect(c.perServingMinor).toBeNull();
    expect(c.toBuyMinor).toBeNull();
    expect(c.cheapestMixedMinor).toBeNull();
    expect(c.complete).toBe(false);
    expect(c.unknownCount).toBe(4);
  });

  it("handles ingredients without a product or quantity", () => {
    const c = cost(2, {
      ingredients: [ing("Salt", null, 5, "g"), ing("Pepper", "pasta", null, null), ing("Pasta", "pasta", 200, "g")],
    });
    expect(line(c, "Salt").unknownReason).toBe("no_product");
    expect(line(c, "Pepper").unknownReason).toBe("no_quantity");
    expect(c.totalMinor).toBe(192);
    expect(c.unknownCount).toBe(2);
  });

  it("an empty recipe has no cost and is not complete", () => {
    const c = cost(2, { ingredients: [] });
    expect(c.totalMinor).toBeNull();
    expect(c.complete).toBe(false);
  });

  it("does not price a product whose pack content is unknown", () => {
    const c = cost(2, { pricing: { ...pricing, pasta: { ...pricing.pasta, basis: null } } });
    expect(line(c, "Pasta").unknownReason).toBe("no_price_basis");
  });
});

describe("last purchase price fallback", () => {
  const withLast = (p: ProductPricing): ProductPricing => ({
    ...p,
    quotes: [],
    lastPurchase: { unitPriceMinor: 520, purchasedOn: "2026-10-20", retailerId: LIDL, retailerName: "Lidl" },
  });

  it("is used when no retailer price exists and is labelled as such", () => {
    const c = cost(2, { pricing: { ...pricing, pasta: withLast(pricing.pasta) } });
    const l = line(c, "Pasta");
    expect(l.cost).toEqual({
      minor: 208,
      source: { kind: "last_purchase", retailerId: LIDL, retailerName: "Lidl", isPromo: false, asOf: "2026-10-20" },
    });
    expect(l.options).toEqual([]);
    expect(l.savingsMinor).toBe(0);
    expect(c.usesLastPurchase).toBe(true);
    expect(c.complete).toBe(true);
  });

  it("never overrides an available retailer price", () => {
    const withBoth: ProductPricing = { ...pricing.pasta, lastPurchase: { unitPriceMinor: 100, purchasedOn: "2026-10-20", retailerId: null, retailerName: null } };
    const c = cost(2, { pricing: { ...pricing, pasta: withBoth } });
    expect(line(c, "Pasta").cost?.source.kind).toBe("retailer");
    expect(c.usesLastPurchase).toBe(false);
  });

  it("is excluded from retailer baskets and savings", () => {
    const c = cost(2, { pricing: { ...pricing, pasta: withLast(pricing.pasta) } });
    expect(c.baskets.map((b) => b.retailerName)).toEqual(["Lidl", "Kaufland"]);
    expect(c.savingsMinor).toBe(12 + 100 + 34);
  });
});

describe("unit conversion inside the calculator", () => {
  it("uses the product unit weight to price eggs listed in grams", () => {
    const c = cost(2, { ingredients: [ing("Eggs", "eggs", 120, "g")] });
    expect(c.totalMinor).toBe(258);
  });

  it("converts kg to g", () => {
    const c = cost(2, { ingredients: [ing("Pasta", "pasta", 0.2, "kg")] });
    expect(c.totalMinor).toBe(192);
  });

  it("refuses to guess when the conversion is unsafe", () => {
    const c = cost(2, { ingredients: [ing("Pasta", "pasta", 2, "pcs"), ing("Oil", "pasta", 100, "ml")] });
    expect(line(c, "Pasta").unknownReason).toBe("unit_conversion");
    expect(line(c, "Pasta").conversionError?.code).toBe("missing_unit_weight");
    expect(line(c, "Oil").conversionError?.code).toBe("missing_density");
    expect(c.totalMinor).toBeNull();
  });

  it("uses a product density only when it is defined", () => {
    const oil: ProductPricing = {
      productId: "oil",
      basis: { quantity: 1, unit: "l" },
      spec: { densityGPerMl: 0.91 },
      quotes: [quote(LIDL, 12)],
      lastPurchase: null,
    };
    const c = cost(2, { pricing: { oil }, ingredients: [ing("Oil", "oil", 91, "g")] });
    expect(c.totalMinor).toBe(120);
  });
});

describe("already at home and pantry", () => {
  it("excludes at-home ingredients from the shopping cost but keeps the recipe value", () => {
    const c = cost(2, { ingredients: carbonara.map((i) => (i.id === "Parmesan" ? { ...i, isAtHome: true } : i)) });
    expect(line(c, "Parmesan")).toMatchObject({ coverage: "at_home", coveredFraction: 1, toBuyMinor: 0 });
    expect(c.totalMinor).toBe(1929);
    expect(c.toBuyMinor).toBe(1929 - 880);
    expect(c.toBuyPerServingMinor).toBe(Math.round((1929 - 880) / 2));
  });

  it("does not count unknown at-home ingredients against the shopping cost", () => {
    const c = cost(2, { ingredients: [ing("Salt", null, 5, "g", { isAtHome: true }), ing("Pasta", "pasta", 200, "g")] });
    expect(c.unknownCount).toBe(1);
    expect(c.toBuyUnknownCount).toBe(0);
    expect(c.toBuyMinor).toBe(192);
  });

  it("uses pantry stock, converting units", () => {
    const c = cost(2, { pantry: [{ productId: "pasta", quantity: 1, unit: "kg" }] });
    expect(line(c, "Pasta")).toMatchObject({ coverage: "pantry", coveredFraction: 1, toBuyMinor: 0 });
    expect(c.toBuyMinor).toBe(1929 - 192);
  });

  it("buys only the missing part when the pantry has less than needed", () => {
    const c = cost(2, { pantry: [{ productId: "pasta", quantity: 50, unit: "g" }] });
    expect(line(c, "Pasta")).toMatchObject({ coverage: "partial_pantry", coveredFraction: 0.25, toBuyMinor: 144 });
  });

  it("ignores pantry stock that cannot be converted safely", () => {
    const c = cost(2, { pantry: [{ productId: "pasta", quantity: 3, unit: "pcs" }, { productId: "pasta", quantity: 5, unit: null }] });
    expect(line(c, "Pasta").coverage).toBeNull();
    expect(c.toBuyMinor).toBe(1929);
  });

  it("scaling increases what the pantry no longer covers", () => {
    const pantry = [{ productId: "pasta", quantity: 200, unit: "g" as const }];
    expect(cost(2, { pantry }).lines[0].coverage).toBe("pantry");
    expect(cost(4, { pantry }).lines[0]).toMatchObject({ coverage: "partial_pantry", coveredFraction: 0.5 });
  });
});

describe("optional ingredients and substitutions", () => {
  it("shows optional ingredients without counting them by default", () => {
    const ingredients = [...carbonara, ing("Parsley", "pasta", 50, "g", { isOptional: true })];
    const c = cost(2, { ingredients });
    expect(line(c, "Parsley").counted).toBe(false);
    expect(line(c, "Parsley").cost?.minor).toBe(48);
    expect(c.totalMinor).toBe(1929);
    expect(cost(2, { ingredients, includeOptional: true }).totalMinor).toBe(1929 + 48);
  });

  it("prices substitutions and compares them with the ingredient", () => {
    const cheddar: ProductPricing = {
      productId: "cheddar",
      basis: { quantity: 200, unit: "g" },
      spec: {},
      quotes: [quote(LIDL, 15)],
      lastPurchase: null,
    };
    const c = cost(2, {
      pricing: { ...pricing, cheddar },
      ingredients: [
        ing("Parmesan", "parmesan", 80, "g", {
          substitutions: [
            { id: "s1", name: "Cheddar", productId: "cheddar", quantity: null, unit: null },
            { id: "s2", name: "Pecorino", productId: null, quantity: 70, unit: "g" },
          ],
        }),
      ],
    });
    const [cheddarCost, pecorino] = c.lines[0].substitutions;
    expect(cheddarCost.cost?.minor).toBe(600);
    expect(cheddarCost.deltaMinor).toBe(600 - 880);
    expect(cheddarCost.quantity).toBe(80);
    expect(pecorino.cost).toBeNull();
    expect(pecorino.unknownReason).toBe("no_product");
    expect(pecorino.deltaMinor).toBeNull();
  });

  it("scales substitution quantities", () => {
    const c = cost(4, {
      ingredients: [ing("Parmesan", "parmesan", 80, "g", { substitutions: [{ id: "s", name: "Pecorino", productId: "parmesan", quantity: 70, unit: "g" }] })],
    });
    expect(c.lines[0].substitutions[0].quantity).toBe(140);
  });
});

describe("promotions", () => {
  it("flags promo prices on the chosen source", () => {
    const promo: ProductPricing = { ...pricing.pasta, quotes: [quote(LIDL, 3.99, { isPromo: true }), quote(KAUFLAND, 5.49)] };
    const c = cost(2, { pricing: { ...pricing, pasta: promo } });
    expect(line(c, "Pasta").cost?.source).toMatchObject({ retailerName: "Lidl", isPromo: true });
    expect(line(c, "Pasta").cost?.minor).toBe(160);
  });
});

describe("pricing lookup interface", () => {
  it("works with any implementation, including partial data", async () => {
    const calls: string[][] = [];
    const lookup: PricingLookup = {
      async getPricing(ids) {
        calls.push([...ids]);
        return ids.flatMap((id) => (pricing[id] ? [pricing[id]] : []));
      },
    };
    const map = await lookupPricing(lookup, ["pasta", "pasta", "unknown-product"]);
    expect(calls).toEqual([["pasta", "unknown-product"]]);
    expect(Object.keys(map)).toEqual(["pasta"]);
    expect(await lookupPricing(lookup, [])).toEqual({});
    expect(calls).toHaveLength(1);
    expect(cost(2, { pricing: map }).unknownCount).toBe(3);
  });

  it("derives the price basis from product packaging without guessing", () => {
    expect(priceBasisFromProduct({ unit: "pcs", package_size: 500, package_unit: "g" })).toEqual({ quantity: 500, unit: "g" });
    expect(priceBasisFromProduct({ unit: "pcs", package_size: 10, package_unit: "pcs" })).toEqual({ quantity: 10, unit: "pcs" });
    expect(priceBasisFromProduct({ unit: "kg", package_size: null, package_unit: null })).toEqual({ quantity: 1, unit: "kg" });
    expect(priceBasisFromProduct({ unit: "pcs", package_size: null, package_unit: null })).toEqual({ quantity: 1, unit: "pcs" });
    expect(priceBasisFromProduct({ unit: "pack", package_size: null, package_unit: null })).toBeNull();
  });
});
