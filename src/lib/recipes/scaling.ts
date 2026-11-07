export const SERVING_PRESETS = [2, 4, 6, 8] as const;

/** Multiplier that turns quantities written for `baseServings` into quantities for `targetServings`. */
export function scaleFactor(baseServings: number, targetServings: number): number {
  if (!Number.isFinite(baseServings) || baseServings <= 0) throw new RangeError("baseServings must be greater than zero");
  if (!Number.isFinite(targetServings) || targetServings <= 0) throw new RangeError("targetServings must be greater than zero");
  return targetServings / baseServings;
}

export function scaleQuantity(quantity: number, baseServings: number, targetServings: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new RangeError("quantity must be zero or greater");
  return Number((quantity * scaleFactor(baseServings, targetServings)).toPrecision(12));
}

/** Human readable amount for the UI: up to `maxDecimals` decimals, no trailing zeros. */
export function formatQuantity(value: number, locale: string, maxDecimals = 2): string {
  return new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-GB", { maximumFractionDigits: maxDecimals }).format(value);
}
