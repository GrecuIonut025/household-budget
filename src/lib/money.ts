/** Money is handled as integer minor units (bani for RON) to avoid floating point drift. */
export type Minor = number;

const MINOR_FACTOR = 100;

export function toMinor(amount: number | string | null | undefined): Minor {
  if (amount === null || amount === undefined || amount === "") return 0;
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * MINOR_FACTOR);
}

export function fromMinor(minor: Minor): number {
  return minor / MINOR_FACTOR;
}

/** Parses user input such as "1.234,56", "1234.56" or "12,5" into minor units. Returns null when invalid. */
export function parseMoneyInput(raw: string): Minor | null {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned) return null;
  let normalised = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // the last separator is the decimal one
    const decimalIsComma = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".");
    normalised = decimalIsComma
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    normalised = cleaned.replace(",", ".");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalised)) return null;
  return toMinor(normalised);
}

export function formatMoney(minor: Minor, currency = "RON", locale = "ro"): string {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(fromMinor(minor));
}

export function localeTag(locale: string): string {
  return locale === "ro" ? "ro-RO" : "en-GB";
}
