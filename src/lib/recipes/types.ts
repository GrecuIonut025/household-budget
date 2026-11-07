import { isUnit, type Unit } from "@/lib/units";
import type { IngredientInput, PantryStock } from "./cost";
import { isRecipeCategory, type RecipeCategory } from "./schema";

export interface SubstitutionRow {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  note: string | null;
}

export interface RecipeIngredientRow {
  id: string;
  product_id: string | null;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  is_optional: boolean;
  is_at_home: boolean;
  note: string | null;
  sort_order: number;
  substitutions: SubstitutionRow[];
}

export interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  instructions: string | null;
  category: RecipeCategory | null;
  tags: string[];
  image_path: string | null;
  source_url: string | null;
  is_favorite: boolean;
  created_at: string;
}

export interface RecipeWithIngredients extends RecipeRow {
  ingredients: RecipeIngredientRow[];
}

export interface ProductOption {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  package_size: number | null;
  package_unit: string | null;
}

export function normaliseUnit(value: unknown): Unit | null {
  return isUnit(value) ? value : null;
}

export function normaliseCategory(value: unknown): RecipeCategory | null {
  return isRecipeCategory(value) ? value : null;
}

export function toCostIngredients(ingredients: readonly RecipeIngredientRow[]): IngredientInput[] {
  return ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    productId: i.product_id,
    quantity: i.quantity,
    unit: i.unit,
    isOptional: i.is_optional,
    isAtHome: i.is_at_home,
    note: i.note,
    substitutions: i.substitutions.map((s) => ({
      id: s.id,
      name: s.name,
      productId: s.product_id,
      quantity: s.quantity,
      unit: s.unit,
    })),
  }));
}

export type { PantryStock };
