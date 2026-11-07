import { convertQuantity, type UnitSpec } from "@/lib/units";
import type { MergedNeed, PantryStock, RecipeIngredientNeed, ShoppingNeed } from "./types";
import { mergeKey } from "./merge";

function pantryAvailable(
  need: MergedNeed,
  pantry: readonly PantryStock[],
  specs: ReadonlyMap<string, UnitSpec>,
): number {
  if (need.quantity === null || need.unit === null || need.quantity <= 0) return 0;
  const spec = (need.productId && specs.get(need.productId)) || {};
  let available = 0;

  for (const stock of pantry) {
    if (stock.quantity <= 0 || stock.unit === null) continue;
    const sameProduct = need.productId && stock.productId === need.productId;
    const sameName =
      !need.productId && !!stock.name && stock.name.trim().toLowerCase() === need.name.trim().toLowerCase();
    if (!sameProduct && !sameName) continue;
    const stockSpec = stock.spec ?? (stock.productId ? specs.get(stock.productId) : undefined) ?? spec;
    const converted = convertQuantity(stock.quantity, stock.unit, need.unit, stockSpec);
    if (converted.ok) available += converted.value;
  }
  return available;
}

/**
 * Subtract pantry stock (and recipe "already at home" flags) from merged needs.
 * Fully covered lines are kept with `toBuyQuantity = 0` so the UI can show them as covered.
 */
export function subtractPantry(
  needs: readonly MergedNeed[],
  pantry: readonly PantryStock[],
  options: {
    /** ingredient ids that were marked at-home on the recipe — skipped entirely */
    atHomeKeys?: ReadonlySet<string>;
    specs?: ReadonlyMap<string, UnitSpec>;
  } = {},
): ShoppingNeed[] {
  const specs = options.specs ?? new Map();
  const atHome = options.atHomeKeys ?? new Set<string>();

  return needs.map((need) => {
    if (atHome.has(need.key)) {
      return {
        ...need,
        toBuyQuantity: 0,
        coveredByPantry: need.quantity ?? 0,
        coveredFraction: 1,
        skippedAtHome: true,
      };
    }

    const available = pantryAvailable(need, pantry, specs);
    if (need.quantity === null || need.quantity <= 0) {
      return {
        ...need,
        toBuyQuantity: need.quantity,
        coveredByPantry: 0,
        coveredFraction: 0,
        skippedAtHome: false,
      };
    }

    const covered = Math.min(need.quantity, available);
    const toBuy = Math.max(0, Number((need.quantity - covered).toPrecision(12)));
    return {
      ...need,
      toBuyQuantity: toBuy,
      coveredByPantry: covered,
      coveredFraction: need.quantity > 0 ? Math.min(1, covered / need.quantity) : 0,
      skippedAtHome: false,
    };
  });
}

/** Build the set of merge keys for ingredients flagged as already at home. */
export function atHomeKeysFromIngredients(ingredients: readonly RecipeIngredientNeed[]): Set<string> {
  const keys = new Set<string>();
  for (const ing of ingredients) {
    if (ing.isAtHome) keys.add(mergeKey(ing.productId, ing.name, ing.unit));
  }
  return keys;
}
