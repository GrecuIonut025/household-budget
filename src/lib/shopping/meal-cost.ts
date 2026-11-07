import { computeRecipeCost, type IngredientInput, type PantryStock, type RecipeCost } from "@/lib/recipes/cost";
import type { PricingMap } from "@/lib/recipes/pricing";
import type { MealType } from "./types";

export interface PlannedMealInput {
  id: string;
  planDate: string;
  mealType: MealType;
  recipeId: string | null;
  recipeTitle: string | null;
  customTitle: string | null;
  baseServings: number | null;
  targetServings: number;
  ingredients: IngredientInput[];
}

export interface PlannedMealCost {
  id: string;
  planDate: string;
  mealType: MealType;
  title: string;
  recipeId: string | null;
  servings: number;
  cost: RecipeCost | null;
  totalMinor: number | null;
  toBuyMinor: number | null;
}

export interface WeekMealBudget {
  meals: PlannedMealCost[];
  /** sum of known meal totals (null when nothing could be priced) */
  estimatedTotalMinor: number | null;
  estimatedToBuyMinor: number | null;
  unknownMealCount: number;
  /** remaining grocery budget in minor units; null when no grocery limit */
  groceryRemainingMinor: number | null;
  /** true when estimated to-buy exceeds remaining grocery budget */
  exceedsGroceryBudget: boolean;
  overByMinor: number;
}

/**
 * Estimate the week's food cost from planned meals using the shared recipe cost calculator.
 * Meals without a recipe (custom titles only) contribute 0 known cost.
 */
export function estimateWeekMealBudget(input: {
  meals: readonly PlannedMealInput[];
  pricing: PricingMap;
  pantry?: readonly PantryStock[];
  groceryRemainingMinor: number | null;
  includeOptional?: boolean;
}): WeekMealBudget {
  const meals: PlannedMealCost[] = input.meals.map((m) => {
    const title = m.recipeTitle ?? m.customTitle ?? "Meal";
    if (!m.recipeId || m.ingredients.length === 0 || !m.baseServings) {
      return {
        id: m.id,
        planDate: m.planDate,
        mealType: m.mealType,
        title,
        recipeId: m.recipeId,
        servings: m.targetServings,
        cost: null,
        totalMinor: null,
        toBuyMinor: null,
      };
    }
    const cost = computeRecipeCost({
      baseServings: m.baseServings,
      targetServings: m.targetServings,
      ingredients: m.ingredients,
      pricing: input.pricing,
      pantry: input.pantry,
      includeOptional: input.includeOptional,
    });
    return {
      id: m.id,
      planDate: m.planDate,
      mealType: m.mealType,
      title,
      recipeId: m.recipeId,
      servings: m.targetServings,
      cost,
      totalMinor: cost.totalMinor,
      toBuyMinor: cost.toBuyMinor,
    };
  });

  const knownTotals = meals.map((m) => m.totalMinor).filter((n): n is number => n !== null);
  const knownToBuy = meals.map((m) => m.toBuyMinor).filter((n): n is number => n !== null);
  const estimatedTotalMinor = knownTotals.length ? knownTotals.reduce((a, b) => a + b, 0) : null;
  const estimatedToBuyMinor = knownToBuy.length ? knownToBuy.reduce((a, b) => a + b, 0) : null;
  const unknownMealCount = meals.filter((m) => m.recipeId && m.totalMinor === null).length;

  const groceryRemainingMinor = input.groceryRemainingMinor;
  const exceeds =
    estimatedToBuyMinor !== null && groceryRemainingMinor !== null && estimatedToBuyMinor > groceryRemainingMinor;
  const overByMinor =
    exceeds && estimatedToBuyMinor !== null && groceryRemainingMinor !== null
      ? estimatedToBuyMinor - groceryRemainingMinor
      : 0;

  return {
    meals,
    estimatedTotalMinor,
    estimatedToBuyMinor,
    unknownMealCount,
    groceryRemainingMinor,
    exceedsGroceryBudget: exceeds,
    overByMinor,
  };
}
