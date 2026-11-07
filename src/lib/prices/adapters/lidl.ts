import type { AdapterOffer } from "../types";
import { DEFAULT_USER_AGENT, type AdapterContext, type AdapterFetchInput, type AdapterResult, type PriceAdapter } from "./types";

export const LIDL_PRICE_FILE_URL =
  "https://www.lidl.ro/explore/assets/webPriceData/ro/preturiZilniceLidl.xlsb";

const TIMEOUT_MS = 20_000;

export interface LidlFileRow {
  name: string;
  size: string | null;
  category: string | null;
  price: number;
}

/** Parses rows already extracted from the EPEL sheet (name, gramaj, category, price). */
export function rowsToOffers(rows: readonly LidlFileRow[], observedAt: string): AdapterOffer[] {
  const offers: AdapterOffer[] = [];
  for (const row of rows) {
    if (!(row.price > 0)) continue; // never invent
    const name = row.name.replace(/^PM_/i, "").trim();
    if (!name) continue;
    const size = row.size?.trim() || null;
    offers.push({
      adapter: "lidl_xlsb",
      retailerSlug: "lidl",
      externalRef: `lidl_xlsb:${name.toLowerCase()}|${(size ?? "").toLowerCase()}`,
      nameRaw: size ? `${name} ${size}` : name,
      brandRaw: null,
      unitRaw: size,
      categoryRaw: row.category,
      price: Number(row.price.toFixed(2)),
      currency: "RON",
      isPromo: false,
      loyaltyRequired: false,
      gtin: null,
      observedAt,
      sourceUrl: "https://www.lidl.ro/c/preturile-la-zi/s10019622",
      storeExternalId: null,
      storeName: null,
    });
  }
  return offers;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parsePrice(raw: string): number | null {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Converts a SheetJS-like AoA sheet into Lidl rows. Header row is detected by column titles. */
export function parseLidlSheet(data: unknown[][]): LidlFileRow[] {
  if (data.length === 0) return [];
  let start = 0;
  const header = data[0].map((c) => cell(c).toLowerCase());
  if (header.some((h) => h.includes("denumire") || h.includes("pret"))) start = 1;
  const rows: LidlFileRow[] = [];
  for (let i = start; i < data.length; i++) {
    const line = data[i] ?? [];
    const name = cell(line[0]);
    if (!name) continue;
    const price = parsePrice(cell(line[3] ?? line[line.length - 1]));
    if (price === null) continue;
    rows.push({
      name,
      size: cell(line[1]) || null,
      category: cell(line[2]) || null,
      price,
    });
  }
  return rows;
}

async function parseXlsb(buffer: ArrayBuffer): Promise<LidlFileRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.find((n) => n.toUpperCase() === "EPEL") ?? workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: "" });
  return parseLidlSheet(aoa as unknown[][]);
}

export const lidlAdapter: PriceAdapter = {
  id: "lidl_xlsb",
  label: "Lidl daily price file",
  async fetchOffers(_input: AdapterFetchInput, ctx: AdapterContext = {}): Promise<AdapterResult> {
    const warnings: string[] = [];
    const now = ctx.now ?? new Date();
    try {
      const doFetch = ctx.fetchImpl ?? fetch;
      const res = await doFetch(LIDL_PRICE_FILE_URL, {
        headers: { "User-Agent": ctx.userAgent ?? DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        return { ok: false, error: `Lidl file HTTP ${res.status}`, offers: [], warnings };
      }
      const rows = await parseXlsb(await res.arrayBuffer());
      if (rows.length === 0) warnings.push("Lidl file parsed but contained no priced rows.");
      return { ok: true, offers: rowsToOffers(rows, now.toISOString()), warnings };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Lidl file fetch failed",
        offers: [],
        warnings,
      };
    }
  },
};
