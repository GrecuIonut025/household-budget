import type { Unit, UnitSpec } from "@/lib/units";
import type { PricingMap } from "@/lib/recipes/pricing";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/** One ingredient contribution coming from a recipe (already scaled to plan servings). */
export interface RecipeIngredientNeed {
  recipeId: string;
  recipeTitle: string;
  ingredientId: string;
  name: string;
  productId: string | null;
  quantity: number | null;
  unit: Unit | null;
  isOptional: boolean;
  isAtHome: boolean;
  note?: string | null;
}

export interface PantryStock {
  productId: string | null;
  /** used when matching free-text needs without a product id */
  name?: string;
  quantity: number;
  unit: Unit | null;
  /** optional product packaging facts for cross-unit conversion */
  spec?: UnitSpec;
}

export interface MergedNeed {
  /** stable merge key */
  key: string;
  name: string;
  productId: string | null;
  quantity: number | null;
  unit: Unit | null;
  isOptional: boolean;
  /** every recipe that contributed to this line */
  sources: { recipeId: string; recipeTitle: string; quantity: number | null; unit: Unit | null }[];
  notes: string[];
}

export interface ShoppingNeed extends MergedNeed {
  /** quantity still to buy after pantry / at-home subtraction */
  toBuyQuantity: number | null;
  coveredByPantry: number;
  coveredFraction: number;
  skippedAtHome: boolean;
}

export type StrategyKind = "cheapest_single" | "cheapest_combo" | "preferred" | "min_visits";

export interface PricedLineOption {
  retailerId: string;
  retailerName: string;
  /** total for the to-buy quantity at this retailer */
  totalMinor: number;
  unitPriceMinor: number;
  isPromo: boolean;
}

export interface PricedShoppingLine {
  need: ShoppingNeed;
  options: PricedLineOption[];
  /** cheapest option, if any */
  cheapest: PricedLineOption | null;
  unknownReason: "no_product" | "no_quantity" | "no_price" | "no_price_basis" | "unit_conversion" | "fully_covered" | null;
}

export interface StrategyAssignment {
  key: string;
  name: string;
  productId: string | null;
  quantity: number | null;
  unit: Unit | null;
  retailerId: string | null;
  retailerName: string | null;
  totalMinor: number | null;
  unitPriceMinor: number | null;
}

export interface StrategyResult {
  kind: StrategyKind;
  label: string;
  totalMinor: number | null;
  /** retailers used (unique) */
  retailerCount: number;
  retailers: { id: string; name: string; totalMinor: number; itemCount: number }[];
  /** lines that could not be priced under this strategy */
  missingCount: number;
  assignments: StrategyAssignment[];
  /** estimated savings vs the most expensive complete single-retailer basket (0 when unknown) */
  savingsMinor: number;
}

export interface BasketCompareInput {
  lines: readonly PricedShoppingLine[];
  pricing: PricingMap;
  preferredRetailerId?: string | null;
  /** when comparing savings, use this as the expensive baseline; otherwise the dearest complete single basket */
  expensiveBaselineMinor?: number | null;
}
