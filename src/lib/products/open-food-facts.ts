import { isValidGtin } from "./gtin";
import type { PackageUnit } from "./types";

/**
 * Open Food Facts lookup. The data is licensed under the ODbL: show the attribution whenever it is displayed and
 * only ever use it to prefill a form the user confirms.
 */
export const OFF_ATTRIBUTION = {
  name: "Open Food Facts",
  url: "https://world.openfoodfacts.org",
  licenseName: "ODbL",
  licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
} as const;

export interface OffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  packageSize: number | null;
  packageUnit: PackageUnit | null;
  /** link to the public product page, for attribution and for the user to double-check */
  sourceUrl: string;
}

export type OffLookup =
  | { status: "found"; product: OffProduct }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "rate_limited" }
  | { status: "unavailable" };

const QUANTITY = /^\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|dl|l)\b\.?\s*$/i;
const FACTORS: Record<string, { unit: PackageUnit; factor: number }> = {
  g: { unit: "g", factor: 1 },
  kg: { unit: "kg", factor: 1 },
  ml: { unit: "ml", factor: 1 },
  cl: { unit: "ml", factor: 10 },
  dl: { unit: "ml", factor: 100 },
  l: { unit: "l", factor: 1 },
};

/** Parses simple single-pack quantities ("500 g", "1,5 l"). Multi-packs and anything ambiguous yield nulls. */
export function parseOffQuantity(raw: unknown): { size: number; unit: PackageUnit } | null {
  if (typeof raw !== "string") return null;
  const match = QUANTITY.exec(raw);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  const conversion = FACTORS[match[2].toLowerCase()];
  if (!Number.isFinite(value) || value <= 0 || !conversion) return null;
  return { size: Number((value * conversion.factor).toFixed(3)), unit: conversion.unit };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Extracts only what the API actually returned. A product without a name is treated as not usable. */
export function parseOffResponse(json: unknown, barcode: string, locale: "ro" | "en" = "ro"): OffProduct | null {
  if (typeof json !== "object" || json === null) return null;
  const root = json as { status?: unknown; product?: unknown };
  if (root.status !== 1 || typeof root.product !== "object" || root.product === null) return null;
  const p = root.product as Record<string, unknown>;
  const name = text(p[`product_name_${locale}`]) ?? text(p.product_name) ?? text(p.generic_name);
  if (!name) return null;
  const brand = text(p.brands)?.split(",")[0]?.trim() || null;
  const quantity = parseOffQuantity(p.quantity);
  return {
    barcode,
    name: name.slice(0, 200),
    brand: brand ? brand.slice(0, 120) : null,
    packageSize: quantity?.size ?? null,
    packageUnit: quantity?.unit ?? null,
    sourceUrl: `${OFF_ATTRIBUTION.url}/product/${barcode}`,
  };
}

const FIELDS = "code,product_name,product_name_ro,product_name_en,generic_name,brands,quantity";
const TIMEOUT_MS = 4000;

export interface OffFetchOptions {
  fetchImpl?: typeof fetch;
  userAgent: string;
  locale?: "ro" | "en";
}

/** One network call to the public API. Callers are responsible for caching and rate limiting. */
export async function fetchOpenFoodFacts(barcode: string, opts: OffFetchOptions): Promise<OffLookup> {
  if (!isValidGtin(barcode)) return { status: "invalid" };
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${OFF_ATTRIBUTION.url}/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": opts.userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return { status: "not_found" };
    if (res.status === 429) return { status: "rate_limited" };
    if (!res.ok) return { status: "unavailable" };
    const product = parseOffResponse(await res.json(), barcode, opts.locale);
    return product ? { status: "found", product } : { status: "not_found" };
  } catch {
    return { status: "unavailable" };
  }
}
