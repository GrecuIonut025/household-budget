/**
 * Pure unit conversion for recipe quantities.
 *
 * Supported units: g, kg (mass), ml, l (volume) and pcs (individual pieces).
 * Crossing dimensions is only allowed when the product defines the needed value:
 *   mass   <-> count   needs `unitWeightG`
 *   volume <-> count   needs `unitVolumeMl`
 *   mass   <-> volume  needs `densityGPerMl`
 * Anything else is refused with a typed error; nothing is ever guessed.
 */

export const UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
export type Unit = (typeof UNITS)[number];

export type Dimension = "mass" | "volume" | "count";

const DIMENSION: Record<Unit, Dimension> = { g: "mass", kg: "mass", ml: "volume", l: "volume", pcs: "count" };
/** Multiplier from the unit to the base unit of its dimension (g, ml, pcs). */
const TO_BASE: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, l: 1000, pcs: 1 };
const BASE_UNIT: Record<Dimension, Unit> = { mass: "g", volume: "ml", count: "pcs" };

/** Product-defined facts that make cross-dimension conversion possible. All optional. */
export interface UnitSpec {
  /** grams in one piece, e.g. 60 for an egg */
  unitWeightG?: number | null;
  /** millilitres in one piece, e.g. 330 for a can */
  unitVolumeMl?: number | null;
  /** grams per millilitre, e.g. 0.91 for olive oil */
  densityGPerMl?: number | null;
}

export type ConversionErrorCode =
  | "invalid_quantity"
  | "unknown_unit"
  | "missing_unit_weight"
  | "missing_unit_volume"
  | "missing_density";

export interface ConversionError {
  code: ConversionErrorCode;
  message: string;
  from: string;
  to: string;
}

export type ConversionResult = { ok: true; value: number } | { ok: false; error: ConversionError };

export class UnitConversionError extends Error {
  readonly code: ConversionErrorCode;
  constructor(readonly detail: ConversionError) {
    super(detail.message);
    this.name = "UnitConversionError";
    this.code = detail.code;
  }
}

const ALIASES: Record<string, Unit> = {
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  millilitre: "ml",
  milliliter: "ml",
  l: "l",
  litre: "l",
  liter: "l",
  litres: "l",
  liters: "l",
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  buc: "pcs",
  bucata: "pcs",
  bucati: "pcs",
  unit: "pcs",
  units: "pcs",
};

/** Normalises a free-form unit label ("Kg", "buc", "liters") to a supported unit, or null. */
export function parseUnit(raw: string | null | undefined): Unit | null {
  if (!raw) return null;
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.$/, "");
  return ALIASES[key] ?? null;
}

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}

export function dimensionOf(unit: Unit): Dimension {
  return DIMENSION[unit];
}

export function baseUnitOf(unit: Unit): Unit {
  return BASE_UNIT[DIMENSION[unit]];
}

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Removes binary floating point noise (0.1 + 0.2) without hiding real precision. */
function clean(value: number): number {
  return Number(value.toPrecision(12));
}

function fail(code: ConversionErrorCode, message: string, from: string, to: string): ConversionResult {
  return { ok: false, error: { code, message, from, to } };
}

export function convertQuantity(quantity: number, from: string, to: string, spec: UnitSpec = {}): ConversionResult {
  const fromUnit = isUnit(from) ? from : null;
  const toUnit = isUnit(to) ? to : null;
  if (!fromUnit || !toUnit) {
    const bad = !fromUnit ? from : to;
    return fail("unknown_unit", `Unsupported unit "${bad}"`, from, to);
  }
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
    return fail("invalid_quantity", "Quantity must be a finite number that is zero or greater", from, to);
  }

  const fromDim = DIMENSION[fromUnit];
  const toDim = DIMENSION[toUnit];
  const inBase = quantity * TO_BASE[fromUnit];

  if (fromDim === toDim) return { ok: true, value: clean(inBase / TO_BASE[toUnit]) };

  let converted: number;
  const pair = `${fromDim}->${toDim}`;
  switch (pair) {
    case "count->mass":
      if (!positive(spec.unitWeightG)) return fail("missing_unit_weight", `Cannot convert ${from} to ${to}: the product has no unit weight`, from, to);
      converted = inBase * spec.unitWeightG;
      break;
    case "mass->count":
      if (!positive(spec.unitWeightG)) return fail("missing_unit_weight", `Cannot convert ${from} to ${to}: the product has no unit weight`, from, to);
      converted = inBase / spec.unitWeightG;
      break;
    case "count->volume":
      if (!positive(spec.unitVolumeMl)) return fail("missing_unit_volume", `Cannot convert ${from} to ${to}: the product has no unit volume`, from, to);
      converted = inBase * spec.unitVolumeMl;
      break;
    case "volume->count":
      if (!positive(spec.unitVolumeMl)) return fail("missing_unit_volume", `Cannot convert ${from} to ${to}: the product has no unit volume`, from, to);
      converted = inBase / spec.unitVolumeMl;
      break;
    case "volume->mass":
      if (!positive(spec.densityGPerMl)) return fail("missing_density", `Cannot convert ${from} to ${to}: the product has no density`, from, to);
      converted = inBase * spec.densityGPerMl;
      break;
    case "mass->volume":
      if (!positive(spec.densityGPerMl)) return fail("missing_density", `Cannot convert ${from} to ${to}: the product has no density`, from, to);
      converted = inBase / spec.densityGPerMl;
      break;
    default:
      return fail("unknown_unit", `Unsupported conversion ${from} to ${to}`, from, to);
  }
  return { ok: true, value: clean(converted / TO_BASE[toUnit]) };
}

/** Like convertQuantity but throws a UnitConversionError. */
export function convertQuantityOrThrow(quantity: number, from: string, to: string, spec: UnitSpec = {}): number {
  const result = convertQuantity(quantity, from, to, spec);
  if (!result.ok) throw new UnitConversionError(result.error);
  return result.value;
}

export function canConvert(from: string, to: string, spec: UnitSpec = {}): boolean {
  return convertQuantity(0, from, to, spec).ok;
}
