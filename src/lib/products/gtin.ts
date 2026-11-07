/** GTIN-8/12/13/14 (EAN/UPC) helpers. Mirrors `public.is_valid_gtin()` in the database. */

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** Strips the spaces and hyphens people type or copy into barcode fields. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** Mod-10 check digit for a GTIN body (the code without its last digit). */
export function gtinCheckDigit(body: string): number {
  let total = 0;
  let weight = 3;
  for (let i = body.length - 1; i >= 0; i--) {
    total += Number(body[i]) * weight;
    weight = 4 - weight;
  }
  return (10 - (total % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^[0-9]+$/.test(code) || !GTIN_LENGTHS.has(code.length)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * Equivalent spellings of one product code. A UPC-A is an EAN-13 with a leading zero (scanners report either),
 * and a GTIN-14 with leading zeros is the same item as its shorter form.
 */
export function barcodeVariants(code: string): string[] {
  if (!isValidGtin(code)) return [];
  const variants = new Set<string>([code]);
  const stripped = code.replace(/^0+/, "");
  for (const length of [12, 13, 14]) {
    if (stripped.length <= length) variants.add(stripped.padStart(length, "0"));
  }
  if (stripped.length <= 8) variants.add(stripped.padStart(8, "0"));
  return [...variants].filter(isValidGtin);
}

export interface BarcodeListResult {
  valid: string[];
  invalid: string[];
}

/** Parses a free-form list (newlines, commas, semicolons) into unique valid codes and the entries that failed. */
export function parseBarcodeList(text: string): BarcodeListResult {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\n,;]+/)) {
    const code = normalizeBarcode(part);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    (isValidGtin(code) ? valid : invalid).push(code);
  }
  return { valid, invalid };
}
