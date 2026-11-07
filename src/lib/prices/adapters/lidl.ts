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

interface ColumnMap {
  name: number;
  size: number | null;
  category: number | null;
  price: number;
}

function detectColumns(header: string[]): ColumnMap | null {
  const lower = header.map((h) => h.toLowerCase());
  const find = (...needles: string[]) => lower.findIndex((h) => needles.some((n) => h.includes(n)));
  const name = find("denumire", "produs", "name");
  const price = find("pret", "preț", "price");
  if (name < 0 || price < 0) return null;
  const size = find("gramaj", "cantitate", "size", "unitate");
  const category = find("categorie", "category");
  return {
    name,
    size: size >= 0 ? size : null,
    category: category >= 0 ? category : null,
    price,
  };
}

/** Converts a SheetJS-like AoA sheet into Lidl rows. Header row is detected by column titles. */
export function parseLidlSheet(data: unknown[][]): LidlFileRow[] {
  if (data.length === 0) return [];

  let start = 0;
  let cols: ColumnMap = { name: 0, size: 1, category: 2, price: 3 };
  const header = (data[0] ?? []).map((c) => cell(c));
  const detected = detectColumns(header);
  if (detected) {
    cols = detected;
    start = 1;
  } else if (header.some((h) => /denumire|pret|preț/i.test(h))) {
    // Header-ish row but columns not recognised — skip it and keep positional fallback.
    start = 1;
  }

  const rows: LidlFileRow[] = [];
  for (let i = start; i < data.length; i++) {
    const line = data[i] ?? [];
    const name = cell(line[cols.name]);
    if (!name) continue;
    const priceCell =
      cols.price < line.length ? cell(line[cols.price]) : cell(line[line.length - 1]);
    const price = parsePrice(priceCell);
    if (price === null) continue;
    rows.push({
      name,
      size: cols.size !== null ? cell(line[cols.size]) || null : cell(line[1]) || null,
      category: cols.category !== null ? cell(line[cols.category]) || null : cell(line[2]) || null,
      price,
    });
  }
  return rows;
}

async function parseXlsb(buffer: ArrayBuffer): Promise<{ rows: LidlFileRow[]; sheetName: string | null }> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!workbook.SheetNames.length) {
    throw new Error("Lidl XLSB has no sheets");
  }
  const sheetName = workbook.SheetNames.find((n) => n.toUpperCase() === "EPEL") ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Lidl XLSB missing sheet “${sheetName}”`);
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: "" });
  if (!Array.isArray(aoa) || aoa.length === 0) {
    throw new Error(`Lidl sheet “${sheetName}” is empty`);
  }
  return { rows: parseLidlSheet(aoa as unknown[][]), sheetName };
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
        return {
          ok: false,
          error: `Lidl file HTTP ${res.status} ${res.statusText || ""}`.trim(),
          offers: [],
          warnings,
        };
      }
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength < 64) {
        return { ok: false, error: "Lidl file response was empty or truncated", offers: [], warnings };
      }
      const { rows, sheetName } = await parseXlsb(buffer);
      if (rows.length === 0) {
        return {
          ok: false,
          error: `Lidl sheet “${sheetName ?? "?"}” parsed but contained no priced rows`,
          offers: [],
          warnings,
        };
      }
      const offers = rowsToOffers(rows, now.toISOString());
      if (offers.length === 0) {
        return {
          ok: false,
          error: "Lidl file had rows but none with a usable positive price",
          offers: [],
          warnings,
        };
      }
      return { ok: true, offers, warnings };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lidl file fetch failed";
      return { ok: false, error: message, offers: [], warnings };
    }
  },
};
