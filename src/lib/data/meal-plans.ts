import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toCostIngredients, type RecipeIngredientRow } from "@/lib/recipes/types";
import { normaliseUnit } from "@/lib/recipes/types";
import type { MealType } from "@/lib/shopping/types";
import { MEAL_TYPES } from "@/lib/shopping/week";

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

export interface MealPlanRow {
  id: string;
  plan_date: string;
  meal_type: MealType;
  recipe_id: string | null;
  custom_title: string | null;
  servings: number | null;
  status: "planned" | "cooked" | "skipped";
  note: string | null;
  recipe_title: string | null;
  recipe_servings: number | null;
}

export interface MealPlanWithIngredients extends MealPlanRow {
  ingredients: RecipeIngredientRow[];
}

interface RawMeal {
  id: string;
  plan_date: string;
  meal_type: MealType;
  recipe_id: string | null;
  custom_title: string | null;
  servings: number | string | null;
  status: "planned" | "cooked" | "skipped";
  note: string | null;
  recipes: { title: string; servings: number | string } | { title: string; servings: number | string }[] | null;
}

export async function getMealPlansBetween(householdId: string, from: string, to: string): Promise<MealPlanRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, plan_date, meal_type, recipe_id, custom_title, servings, status, note, recipes(title, servings)")
    .eq("household_id", householdId)
    .gte("plan_date", from)
    .lte("plan_date", to)
    .order("plan_date")
    .order("meal_type");
  if (error) fail("meal plans", error.message);

  return ((data ?? []) as unknown as RawMeal[]).map((m) => {
    const recipe = Array.isArray(m.recipes) ? m.recipes[0] : m.recipes;
    return {
      id: m.id,
      plan_date: m.plan_date,
      meal_type: m.meal_type,
      recipe_id: m.recipe_id,
      custom_title: m.custom_title,
      servings: m.servings === null ? null : Number(m.servings),
      status: m.status,
      note: m.note,
      recipe_title: recipe?.title ?? null,
      recipe_servings: recipe ? Number(recipe.servings) : null,
    };
  });
}

export async function getMealPlansWithIngredients(
  householdId: string,
  from: string,
  to: string,
): Promise<MealPlanWithIngredients[]> {
  const meals = await getMealPlansBetween(householdId, from, to);
  const recipeIds = [...new Set(meals.map((m) => m.recipe_id).filter((id): id is string => !!id))];
  if (recipeIds.length === 0) return meals.map((m) => ({ ...m, ingredients: [] }));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("id, recipe_id, product_id, name, quantity, unit, is_optional, is_at_home, note, sort_order")
    .eq("household_id", householdId)
    .in("recipe_id", recipeIds)
    .order("sort_order");
  if (error) fail("recipe ingredients", error.message);

  const byRecipe = new Map<string, RecipeIngredientRow[]>();
  for (const i of data ?? []) {
    const list = byRecipe.get(i.recipe_id) ?? [];
    list.push({
      id: i.id,
      product_id: i.product_id,
      name: i.name,
      quantity: i.quantity === null ? null : Number(i.quantity),
      unit: normaliseUnit(i.unit),
      is_optional: i.is_optional,
      is_at_home: i.is_at_home,
      note: i.note,
      sort_order: i.sort_order,
      substitutions: [],
    });
    byRecipe.set(i.recipe_id, list);
  }

  return meals.map((m) => ({
    ...m,
    ingredients: m.recipe_id ? (byRecipe.get(m.recipe_id) ?? []) : [],
  }));
}

export { MEAL_TYPES, toCostIngredients };
