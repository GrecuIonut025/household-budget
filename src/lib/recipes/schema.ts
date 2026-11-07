import { z } from "zod";
import { UNITS } from "@/lib/units";

export const RECIPE_CATEGORIES = ["breakfast", "main", "soup", "salad", "side", "snack", "dessert", "baking", "drink", "other"] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export function isRecipeCategory(value: unknown): value is RecipeCategory {
  return typeof value === "string" && (RECIPE_CATEGORIES as readonly string[]).includes(value);
}

/** Parses "1,5" / "1.5" / "  2 " into a positive finite number; null for empty or invalid input. */
export function parseQuantityInput(raw: string | null | undefined): number | null {
  const cleaned = (raw ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const unit = z.enum(UNITS);
const optionalText = (max: number) => z.string().trim().max(max);

const substitution = z
  .object({
    productId: z.uuid().nullable(),
    name: z.string().trim().min(1).max(200),
    quantity: z.number().positive().max(1_000_000).nullable(),
    unit: unit.nullable(),
    note: optionalText(300),
  })
  .refine((s) => (s.quantity === null) === (s.unit === null), { message: "quantity and unit go together" });

const ingredient = z
  .object({
    productId: z.uuid().nullable(),
    name: z.string().trim().min(1).max(200),
    quantity: z.number().positive().max(1_000_000).nullable(),
    unit: unit.nullable(),
    isOptional: z.boolean(),
    isAtHome: z.boolean(),
    note: optionalText(300),
    substitutions: z.array(substitution).max(10),
  })
  .refine((i) => i.quantity === null || i.unit !== null, { message: "a quantity needs a unit" })
  .refine((i) => i.quantity !== null || i.unit === null, { message: "a unit needs a quantity" });

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), { message: "must be an http(s) link" });

export const recipePayloadSchema = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: optionalText(2000),
  servings: z.number().positive().max(1000),
  prepMinutes: z.number().int().min(0).max(100_000).nullable(),
  cookMinutes: z.number().int().min(0).max(100_000).nullable(),
  category: z.enum(RECIPE_CATEGORIES).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  instructions: optionalText(20_000),
  sourceUrl: httpUrl,
  imagePath: z.string().max(500).nullable(),
  ingredients: z.array(ingredient).max(100),
});

export type RecipePayload = z.infer<typeof recipePayloadSchema>;
export type IngredientPayload = RecipePayload["ingredients"][number];
export type SubstitutionPayload = IngredientPayload["substitutions"][number];
