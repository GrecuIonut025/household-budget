import { describe, expect, it } from "vitest";
import { createTranslator } from "@/lib/i18n";
import { parseQuantityInput, recipePayloadSchema } from "./schema";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const valid = {
  id: uuid(1),
  householdId: uuid(2),
  title: "Pasta Carbonara",
  description: "",
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 15,
  category: "main",
  tags: ["quick"],
  instructions: "Boil pasta.",
  sourceUrl: "",
  imagePath: null,
  ingredients: [
    { productId: uuid(3), name: "Pasta", quantity: 200, unit: "g", isOptional: false, isAtHome: false, note: "", substitutions: [] },
  ],
};

describe("parseQuantityInput", () => {
  it("accepts dot and comma decimals", () => {
    expect(parseQuantityInput("1.5")).toBe(1.5);
    expect(parseQuantityInput("1,5")).toBe(1.5);
    expect(parseQuantityInput(" 200 ")).toBe(200);
  });

  it("rejects empty, zero, negative and malformed input", () => {
    for (const bad of ["", "0", "-1", "abc", "1/2", "1,2,3", "1e3", null, undefined]) {
      expect(parseQuantityInput(bad), String(bad)).toBeNull();
    }
  });
});

describe("recipePayloadSchema", () => {
  it("accepts a complete recipe", () => {
    expect(recipePayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty title, zero servings and an unknown category", () => {
    expect(recipePayloadSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
    expect(recipePayloadSchema.safeParse({ ...valid, servings: 0 }).success).toBe(false);
    expect(recipePayloadSchema.safeParse({ ...valid, category: "lunchbox" }).success).toBe(false);
  });

  it("rejects unsupported units and a quantity without a unit", () => {
    const ing = valid.ingredients[0];
    expect(recipePayloadSchema.safeParse({ ...valid, ingredients: [{ ...ing, unit: "cup" }] }).success).toBe(false);
    expect(recipePayloadSchema.safeParse({ ...valid, ingredients: [{ ...ing, unit: null }] }).success).toBe(false);
    expect(recipePayloadSchema.safeParse({ ...valid, ingredients: [{ ...ing, quantity: null, unit: null }] }).success).toBe(true);
  });

  it("requires substitution quantity and unit together", () => {
    const ing = valid.ingredients[0];
    const sub = { productId: null, name: "Spaghetti", quantity: 200, unit: null, note: "" };
    expect(recipePayloadSchema.safeParse({ ...valid, ingredients: [{ ...ing, substitutions: [sub] }] }).success).toBe(false);
    expect(recipePayloadSchema.safeParse({ ...valid, ingredients: [{ ...ing, substitutions: [{ ...sub, unit: "g" }] }] }).success).toBe(true);
    expect(recipePayloadSchema.safeParse({ ...valid, ingredients: [{ ...ing, substitutions: [{ ...sub, quantity: null }] }] }).success).toBe(true);
  });

  it("only allows http(s) source links", () => {
    expect(recipePayloadSchema.safeParse({ ...valid, sourceUrl: "https://example.com/r" }).success).toBe(true);
    expect(recipePayloadSchema.safeParse({ ...valid, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("recipes catalogue", () => {
  it("renders plurals in both locales", () => {
    expect(createTranslator("en")("recipes.count", { count: 1 })).toBe("1 recipe");
    expect(createTranslator("en")("recipes.count", { count: 3 })).toBe("3 recipes");
    expect(createTranslator("ro")("recipes.count", { count: 3 })).toBe("3 rețete");
    expect(createTranslator("ro")("recipes.count", { count: 24 })).toBe("24 de rețete");
  });
});
