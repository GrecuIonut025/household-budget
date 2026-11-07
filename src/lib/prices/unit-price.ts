import { parseSize } from "./normalize";
import type { ParsedSize } from "./types";

export interface UnitPrice {
  unitPrice: number;
  unitLabel: "RON/kg" | "RON/l" | "RON/pcs";
}

/** Computes a comparable unit price. Returns null when size is unknown — never guesses. */
export function computeUnitPrice(price: number, size: ParsedSize | null): UnitPrice | null {
  if (!(price > 0) || !size || !(size.qty > 0)) return null;
  if (size.unit === "g") {
    return { unitPrice: Number(((price / size.qty) * 1000).toFixed(4)), unitLabel: "RON/kg" };
  }
  if (size.unit === "ml") {
    return { unitPrice: Number(((price / size.qty) * 1000).toFixed(4)), unitLabel: "RON/l" };
  }
  return { unitPrice: Number((price / size.qty).toFixed(4)), unitLabel: "RON/pcs" };
}

export function computeUnitPriceFromRaw(
  price: number,
  packageSize: number | null,
  packageUnit: string | null,
  nameHint?: string | null,
): UnitPrice | null {
  let size: ParsedSize | null = null;
  if (packageSize && packageUnit) {
    if (packageUnit === "kg") size = { qty: packageSize * 1000, unit: "g", multipack: 1 };
    else if (packageUnit === "l") size = { qty: packageSize * 1000, unit: "ml", multipack: 1 };
    else if (packageUnit === "g" || packageUnit === "ml" || packageUnit === "pcs") {
      size = { qty: packageSize, unit: packageUnit, multipack: 1 };
    }
  }
  size = size ?? parseSize(nameHint ?? null);
  return computeUnitPrice(price, size);
}
