import { convertQuantity, type Unit, type UnitSpec } from "@/lib/units";
import type { MergedNeed, RecipeIngredientNeed } from "./types";

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Merge key: product id when linked, otherwise normalised name (+ unit when present). */
export function mergeKey(productId: string | null, name: string, unit: Unit | null): string {
  if (productId) return `p:${productId}`;
  return `n:${normName(name)}:${unit ?? ""}`;
}

function tryAdd(
  aQty: number,
  aUnit: Unit,
  bQty: number,
  bUnit: Unit,
  spec: UnitSpec,
): { quantity: number; unit: Unit } | null {
  if (aUnit === bUnit) return { quantity: aQty + bQty, unit: aUnit };
  const converted = convertQuantity(bQty, bUnit, aUnit, spec);
  if (converted.ok) return { quantity: aQty + converted.value, unit: aUnit };
  const reverse = convertQuantity(aQty, aUnit, bUnit, spec);
  if (reverse.ok) return { quantity: reverse.value + bQty, unit: bUnit };
  return null;
}

/**
 * Collect ingredients from selected recipes and merge duplicates.
 * Optional ingredients are kept (tagged) so the UI can include them later.
 * At-home ingredients are still merged so pantry subtraction can skip them cleanly.
 */
export function mergeIngredients(
  ingredients: readonly RecipeIngredientNeed[],
  specs: ReadonlyMap<string, UnitSpec> = new Map(),
): MergedNeed[] {
  const byKey = new Map<string, MergedNeed>();

  for (const ing of ingredients) {
    if (ing.quantity !== null && ing.quantity <= 0) continue;
    const key = mergeKey(ing.productId, ing.name, ing.unit);
    const existing = byKey.get(key);
    const source = {
      recipeId: ing.recipeId,
      recipeTitle: ing.recipeTitle,
      quantity: ing.quantity,
      unit: ing.unit,
    };
    const note = ing.note?.trim() ? ing.note.trim() : null;

    if (!existing) {
      byKey.set(key, {
        key,
        name: ing.name.trim(),
        productId: ing.productId,
        quantity: ing.quantity,
        unit: ing.unit,
        isOptional: ing.isOptional,
        sources: [source],
        notes: note ? [note] : [],
      });
      continue;
    }

    existing.sources.push(source);
    if (note && !existing.notes.includes(note)) existing.notes.push(note);
    existing.isOptional = existing.isOptional && ing.isOptional;
    if (!existing.productId && ing.productId) {
      existing.productId = ing.productId;
      existing.name = ing.name.trim();
    }

    if (existing.quantity === null || existing.unit === null || ing.quantity === null || ing.unit === null) {
      // Cannot sum — keep the first known quantity, leave unit as-is when mixed/unknown.
      if (existing.quantity === null && ing.quantity !== null) {
        existing.quantity = ing.quantity;
        existing.unit = ing.unit;
      }
      continue;
    }

    const spec = (existing.productId && specs.get(existing.productId)) || (ing.productId && specs.get(ing.productId)) || {};
    const summed = tryAdd(existing.quantity, existing.unit, ing.quantity, ing.unit, spec);
    if (summed) {
      existing.quantity = Number(summed.quantity.toPrecision(12));
      existing.unit = summed.unit;
    }
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}
