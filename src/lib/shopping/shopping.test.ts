import { describe, expect, it } from "vitest";
import { estimateWeekMealBudget } from "./meal-cost";
import { mergeIngredients, mergeKey } from "./merge";
import { atHomeKeysFromIngredients, subtractPantry } from "./pantry";
import { cheapestComboTotal, priceShoppingNeeds } from "./price";
import { compareStrategies, singleRetailerBaskets } from "./strategies";
import type { RecipeIngredientNeed } from "./types";
import { mondayOf, weekContaining } from "./week";
import type { PricingMap, RetailerQuote } from "@/lib/recipes/pricing";

const LIDL = "r-lidl";
const KAUFLAND = "r-kaufland";
const CARREFOUR = "r-carrefour";
const names: Record<string, string> = { [LIDL]: "Lidl", [KAUFLAND]: "Kaufland", [CARREFOUR]: "Carrefour" };

const quote = (retailerId: string, price: number, extra: Partial<RetailerQuote> = {}): RetailerQuote => ({
  retailerId,
  retailerName: names[retailerId],
  priceMinor: Math.round(price * 100),
  isPromo: false,
  observedAt: "2026-11-06T08:00:00Z",
  ...extra,
});

const pricing: PricingMap = {
  milk: {
    productId: "milk",
    basis: { quantity: 1, unit: "l" },
    spec: {},
    quotes: [quote(LIDL, 6.5), quote(KAUFLAND, 7.2), quote(CARREFOUR, 6.9)],
    lastPurchase: null,
  },
  bread: {
    productId: "bread",
    basis: { quantity: 1, unit: "pcs" },
    spec: {},
    quotes: [quote(LIDL, 4.5), quote(KAUFLAND, 3.9), quote(CARREFOUR, 5.0)],
    lastPurchase: null,
  },
  eggs: {
    productId: "eggs",
    basis: { quantity: 10, unit: "pcs" },
    spec: { unitWeightG: 60 },
    quotes: [quote(LIDL, 12.9), quote(KAUFLAND, 13.5)],
    lastPurchase: null,
  },
  butter: {
    productId: "butter",
    basis: { quantity: 200, unit: "g" },
    spec: {},
    quotes: [quote(CARREFOUR, 9.9)],
    lastPurchase: null,
  },
};

const need = (
  over: Partial<RecipeIngredientNeed> & Pick<RecipeIngredientNeed, "ingredientId" | "name" | "productId" | "quantity" | "unit">,
): RecipeIngredientNeed => ({
  recipeId: over.recipeId ?? "r1",
  recipeTitle: over.recipeTitle ?? "Recipe",
  isOptional: false,
  isAtHome: false,
  ...over,
});

describe("mergeIngredients", () => {
  it("merges the same product across recipes and sums quantities", () => {
    const merged = mergeIngredients([
      need({ ingredientId: "i1", name: "Milk", productId: "milk", quantity: 0.5, unit: "l", recipeId: "a", recipeTitle: "Porridge" }),
      need({ ingredientId: "i2", name: "Lapte", productId: "milk", quantity: 250, unit: "ml", recipeId: "b", recipeTitle: "Coffee" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].productId).toBe("milk");
    expect(merged[0].quantity).toBe(0.75);
    expect(merged[0].unit).toBe("l");
    expect(merged[0].sources).toHaveLength(2);
  });

  it("keeps free-text ingredients separate when names differ", () => {
    const merged = mergeIngredients([
      need({ ingredientId: "i1", name: "Salt", productId: null, quantity: 1, unit: "g" }),
      need({ ingredientId: "i2", name: "Pepper", productId: null, quantity: 1, unit: "g" }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("merges free-text by normalised name + unit", () => {
    const merged = mergeIngredients([
      need({ ingredientId: "i1", name: "Salt", productId: null, quantity: 2, unit: "g", recipeId: "a", recipeTitle: "A" }),
      need({ ingredientId: "i2", name: " salt ", productId: null, quantity: 3, unit: "g", recipeId: "b", recipeTitle: "B" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);
    expect(mergeKey(null, "Salt", "g")).toBe(mergeKey(null, " salt ", "g"));
  });
});

describe("subtractPantry", () => {
  it("reduces quantities by matching pantry stock", () => {
    const merged = mergeIngredients([
      need({ ingredientId: "i1", name: "Milk", productId: "milk", quantity: 1, unit: "l" }),
      need({ ingredientId: "i2", name: "Bread", productId: "bread", quantity: 2, unit: "pcs" }),
    ]);
    const shopping = subtractPantry(merged, [
      { productId: "milk", name: "Milk", quantity: 500, unit: "ml" },
      { productId: "bread", name: "Bread", quantity: 2, unit: "pcs" },
    ]);
    const milk = shopping.find((s) => s.productId === "milk")!;
    const bread = shopping.find((s) => s.productId === "bread")!;
    expect(milk.toBuyQuantity).toBe(0.5);
    expect(milk.coveredFraction).toBe(0.5);
    expect(bread.toBuyQuantity).toBe(0);
    expect(bread.coveredFraction).toBe(1);
  });

  it("skips ingredients marked at home", () => {
    const ingredients = [
      need({ ingredientId: "i1", name: "Eggs", productId: "eggs", quantity: 4, unit: "pcs", isAtHome: true }),
    ];
    const merged = mergeIngredients(ingredients);
    const shopping = subtractPantry(merged, [], { atHomeKeys: atHomeKeysFromIngredients(ingredients) });
    expect(shopping[0].toBuyQuantity).toBe(0);
    expect(shopping[0].skippedAtHome).toBe(true);
  });
});

describe("price + strategies", () => {
  const merged = mergeIngredients([
    need({ ingredientId: "i1", name: "Milk", productId: "milk", quantity: 1, unit: "l" }),
    need({ ingredientId: "i2", name: "Bread", productId: "bread", quantity: 1, unit: "pcs" }),
    need({ ingredientId: "i3", name: "Eggs", productId: "eggs", quantity: 10, unit: "pcs" }),
    need({ ingredientId: "i4", name: "Butter", productId: "butter", quantity: 200, unit: "g" }),
  ]);
  const needs = subtractPantry(merged, []);
  const lines = priceShoppingNeeds(needs, pricing);

  it("prices each line at retailer options cheapest first", () => {
    const milk = lines.find((l) => l.need.productId === "milk")!;
    expect(milk.cheapest?.retailerName).toBe("Lidl");
    expect(milk.cheapest?.totalMinor).toBe(650);
  });

  it("computes cheapest combination total", () => {
    // milk Lidl 650 + bread Kaufland 390 + eggs Lidl 1290 + butter Carrefour 990 = 3320
    expect(cheapestComboTotal(lines)).toBe(3320);
  });

  it("ranks single-retailer baskets", () => {
    const baskets = singleRetailerBaskets(lines);
    const complete = baskets.filter((b) => b.missingCount === 0);
    // Lidl has milk+bread+eggs but not butter → missing; Carrefour has milk+bread+butter but not eggs
    // Kaufland has milk+bread+eggs, no butter
    expect(complete).toHaveLength(0);
    expect(baskets[0].missingCount).toBe(1);
  });

  it("compares strategies and reports savings", () => {
    const results = compareStrategies({ lines, pricing, preferredRetailerId: LIDL });
    const byKind = Object.fromEntries(results.map((r) => [r.kind, r]));

    expect(byKind.cheapest_combo.totalMinor).toBe(3320);
    expect(byKind.cheapest_combo.retailerCount).toBeGreaterThan(1);

    expect(byKind.preferred.assignments.every((a) => a.retailerId === LIDL || a.retailerId === CARREFOUR)).toBe(true);
    // butter not at Lidl → falls back to Carrefour
    const butter = byKind.preferred.assignments.find((a) => a.productId === "butter")!;
    expect(butter.retailerId).toBe(CARREFOUR);

    expect(byKind.min_visits.retailerCount).toBeLessThanOrEqual(byKind.cheapest_combo.retailerCount);
    expect(byKind.cheapest_combo.savingsMinor).toBeGreaterThan(0);
  });

  it("preferred without a retailer leaves lines unassigned", () => {
    const results = compareStrategies({ lines, pricing, preferredRetailerId: null });
    const preferred = results.find((r) => r.kind === "preferred")!;
    expect(preferred.totalMinor).toBeNull();
    expect(preferred.missingCount).toBe(4);
  });
});

describe("estimateWeekMealBudget", () => {
  it("sums recipe costs and warns when over grocery remaining", () => {
    const result = estimateWeekMealBudget({
      groceryRemainingMinor: 2000,
      pricing,
      meals: [
        {
          id: "m1",
          planDate: "2026-11-09",
          mealType: "breakfast",
          recipeId: "r1",
          recipeTitle: "Eggs on toast",
          customTitle: null,
          baseServings: 2,
          targetServings: 2,
          ingredients: [
            {
              id: "i1",
              name: "Eggs",
              productId: "eggs",
              quantity: 4,
              unit: "pcs",
              isOptional: false,
              isAtHome: false,
              substitutions: [],
            },
            {
              id: "i2",
              name: "Bread",
              productId: "bread",
              quantity: 2,
              unit: "pcs",
              isOptional: false,
              isAtHome: false,
              substitutions: [],
            },
          ],
        },
      ],
    });
    // eggs 4/10 * 1290 = 516; bread 2 * 390 = 780; total 1296
    expect(result.estimatedTotalMinor).toBe(1296);
    expect(result.exceedsGroceryBudget).toBe(false);

    const over = estimateWeekMealBudget({
      groceryRemainingMinor: 500,
      pricing,
      meals: result.meals.map((m) => ({
        id: m.id,
        planDate: m.planDate,
        mealType: m.mealType,
        recipeId: m.recipeId,
        recipeTitle: m.title,
        customTitle: null,
        baseServings: 2,
        targetServings: 2,
        ingredients: [
          {
            id: "i1",
            name: "Eggs",
            productId: "eggs",
            quantity: 4,
            unit: "pcs",
            isOptional: false,
            isAtHome: false,
            substitutions: [],
          },
          {
            id: "i2",
            name: "Bread",
            productId: "bread",
            quantity: 2,
            unit: "pcs",
            isOptional: false,
            isAtHome: false,
            substitutions: [],
          },
        ],
      })),
    });
    expect(over.exceedsGroceryBudget).toBe(true);
    expect(over.overByMinor).toBe(796);
  });
});

describe("week helpers", () => {
  it("returns a Monday-Sunday week", () => {
    // 2026-11-07 is Saturday
    const week = weekContaining("2026-11-07");
    expect(week.start).toBe("2026-11-02");
    expect(week.end).toBe("2026-11-08");
    expect(week.days).toHaveLength(7);
    expect(mondayOf("2026-11-07")).toBe("2026-11-02");
  });
});
