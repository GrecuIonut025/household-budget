import { z } from "zod";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const shoppingStrategySchema = z.enum(["cheapest_single", "cheapest_combo", "preferred", "min_visits"]);
export const shoppingListStatusSchema = z.enum(["draft", "active", "completed", "archived"]);

export const upsertMealSchema = z.object({
  householdId: z.uuid(),
  id: z.uuid().optional(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: mealTypeSchema,
  recipeId: z.uuid().nullable().optional(),
  customTitle: z.string().trim().max(200).nullable().optional(),
  servings: z.coerce.number().positive().max(99).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const deleteMealSchema = z.object({
  householdId: z.uuid(),
  id: z.uuid(),
});

export const createListFromPlanSchema = z.object({
  householdId: z.uuid(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(120),
  includeOptional: z.boolean().optional(),
  preferredRetailerId: z.uuid().nullable().optional(),
  strategy: shoppingStrategySchema.optional(),
});

export const createListSchema = z.object({
  householdId: z.uuid(),
  name: z.string().trim().min(1).max(120),
});

export const toggleItemSchema = z.object({
  householdId: z.uuid(),
  itemId: z.uuid(),
  checked: z.boolean(),
});

export const reserveBudgetSchema = z.object({
  householdId: z.uuid(),
  listId: z.uuid(),
  amount: z.coerce.number().positive().max(1_000_000),
  note: z.string().trim().max(300).optional(),
});

export const completeListSchema = z.object({
  householdId: z.uuid(),
  listId: z.uuid(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scope: z.enum(["shared", "individual"]).optional(),
});

export const updateItemPriceSchema = z.object({
  householdId: z.uuid(),
  itemId: z.uuid(),
  actualUnitPrice: z.coerce.number().nonnegative().max(1_000_000).nullable(),
});
