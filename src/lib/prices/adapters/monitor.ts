import type { AdapterOffer } from "../types";
import { DEFAULT_USER_AGENT, type AdapterContext, type AdapterFetchInput, type AdapterResult, type PriceAdapter } from "./types";

export const MONITOR_BASE = "https://monitorulpreturilor.info/pmonsvc/Retail";

/** Verified network ids from research (2026-11-07). */
export const MONITOR_NETWORK_IDS: Record<string, string> = {
  lidl: "4055329000008",
  kaufland: "KAUFLAND",
  carrefour: "5940475006709",
  auchan: "AUCHAN",
  penny: "PENNY",
  profi: "PROFI",
  "mega-image": "5940475870003",
};

const SLUG_BY_NETWORK = Object.fromEntries(Object.entries(MONITOR_NETWORK_IDS).map(([slug, id]) => [id, slug]));

const TIMEOUT_MS = 12_000;
const MAX_IDS_PER_CALL = 10;

function xmlText(block: string, tag: string): string | null {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${tag}>`, "i");
  const m = re.exec(block);
  return m ? m[1].trim() : null;
}

function xmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*>[\\s\\S]*?</(?:[a-zA-Z0-9]+:)?${tag}>`, "gi");
  return xml.match(re) ?? [];
}

/** Parses Monitor catalog product XML into id/name pairs. */
export function parseCatalogProducts(xml: string): { id: string; name: string; category: string | null }[] {
  return xmlBlocks(xml, "CatalogProduct")
    .map((block) => {
      const id = xmlText(block, "Id");
      const name = xmlText(block, "Name");
      if (!id || !name) return null;
      const category = xmlText(block, "Prodcateg");
      return { id, name, category: category && category !== "null" ? category : null };
    })
    .filter((x): x is { id: string; name: string; category: string | null } => x !== null);
}

function parseMonitorDate(raw: string | null, fallback: Date): string {
  if (!raw) return fallback.toISOString();
  // dd.MM.yyyy HH:mm — treat as Europe/Bucharest wall time → approximate as UTC+2 for storage
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(raw);
  if (!m) return fallback.toISOString();
  const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? "12"}:${m[5] ?? "00"}:00+02:00`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : fallback.toISOString();
}

/**
 * Parses GetStoresForProducts* responses into offers. Price 0 is a sentinel ("not sold") and is dropped.
 * EAN is never present in this API — matching must use name / prior links.
 */
export function parseStoreProductOffers(xml: string, now: Date): AdapterOffer[] {
  const offers: AdapterOffer[] = [];
  for (const storeBlock of xmlBlocks(xml, "Store")) {
    const storeId = xmlText(storeBlock, "Id");
    const storeName = xmlText(storeBlock, "Name");
    // Nested product rows vary; walk every Price-bearing sibling-ish Product block inside the store.
    for (const productBlock of xmlBlocks(storeBlock, "Product")) {
      const priceRaw = xmlText(productBlock, "Price");
      const price = priceRaw === null ? NaN : Number(priceRaw.replace(",", "."));
      if (!Number.isFinite(price) || price <= 0) continue; // never invent; drop sentinel 0
      const name = xmlText(productBlock, "Name") ?? xmlText(productBlock, "Catprod");
      if (!name) continue;
      const network = xmlText(productBlock, "Networkid") ?? xmlText(storeBlock, "Networkid") ?? "";
      const slug = SLUG_BY_NETWORK[network] ?? "unknown";
      if (slug === "unknown") continue;
      const catalogId =
        xmlText(productBlock, "Catprodid") ?? xmlText(productBlock, "Id") ?? `${slug}:${name}`;
      const brand = xmlText(productBlock, "Brand");
      const unit = xmlText(productBlock, "Unit");
      const category = xmlText(productBlock, "Retailcategname") ?? xmlText(productBlock, "Prodcateg");
      const promo = xmlText(productBlock, "Promo");
      const pricedate = xmlText(productBlock, "Pricedate") ?? xmlText(storeBlock, "Lastupdate");
      offers.push({
        adapter: "monitor",
        retailerSlug: slug,
        externalRef: `monitor:${catalogId}`,
        nameRaw: name.trim(),
        brandRaw: brand && brand !== "null" ? brand.trim() : null,
        unitRaw: unit && unit !== "null" ? unit.trim() : null,
        categoryRaw: category && category !== "null" ? category.trim() : null,
        price: Number(price.toFixed(2)),
        currency: "RON",
        isPromo: !!promo && /promo/i.test(promo),
        loyaltyRequired: false,
        gtin: null,
        observedAt: parseMonitorDate(pricedate, now),
        sourceUrl: "https://monitorulpreturilor.info/",
        storeExternalId: storeId,
        storeName,
      });
    }
  }
  return offers;
}

async function getXml(url: string, ctx: AdapterContext): Promise<string> {
  const doFetch = ctx.fetchImpl ?? fetch;
  const res = await doFetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*", "User-Agent": ctx.userAgent ?? DEFAULT_USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Monitor HTTP ${res.status}`);
  return res.text();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const monitorAdapter: PriceAdapter = {
  id: "monitor",
  label: "Monitorul Prețurilor",
  async fetchOffers(input: AdapterFetchInput, ctx: AdapterContext = {}): Promise<AdapterResult> {
    const warnings: string[] = [];
    const now = ctx.now ?? new Date();
    const names = (input.queryNames ?? []).map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) {
      return { ok: false, error: "No product names to query", offers: [], warnings };
    }

    try {
      const catalogIds: string[] = [];
      for (const name of names.slice(0, 20)) {
        const xml = await getXml(
          `${MONITOR_BASE}/GetCatalogProductsByNameNetwork?prodname=${encodeURIComponent(name)}`,
          ctx,
        );
        const found = parseCatalogProducts(xml);
        if (found.length === 0) warnings.push(`No Monitor catalog hits for “${name}”.`);
        for (const row of found.slice(0, 8)) catalogIds.push(row.id);
      }
      const uniqueIds = [...new Set(catalogIds)];
      if (uniqueIds.length === 0) {
        return { ok: true, offers: [], warnings };
      }

      const networkIds =
        input.networkIds?.join(",") ?? Object.values(MONITOR_NETWORK_IDS).join(",");
      const offers: AdapterOffer[] = [];
      for (const ids of chunk(uniqueIds, MAX_IDS_PER_CALL)) {
        const csv = ids.join(",");
        let url: string;
        if (input.uatId) {
          url = `${MONITOR_BASE}/GetStoresForProductsByUat?uatId=${input.uatId}&csvprodids=${encodeURIComponent(csv)}&csvnetworkids=${encodeURIComponent(networkIds)}&OrderBy=price`;
        } else if (input.lat != null && input.lon != null) {
          const buffer = input.bufferKm ?? 3;
          url = `${MONITOR_BASE}/GetStoresForProductsByLatLon?lat=${input.lat}&lon=${input.lon}&buffer=${buffer}&csvprodids=${encodeURIComponent(csv)}&OrderBy=price`;
        } else {
          // Default: Cluj-Napoca UAT from research, so local demos work without extra config.
          url = `${MONITOR_BASE}/GetStoresForProductsByUat?uatId=54975&csvprodids=${encodeURIComponent(csv)}&csvnetworkids=${encodeURIComponent(networkIds)}&OrderBy=price`;
          warnings.push("No store location set; used Cluj-Napoca (UAT 54975) as default.");
        }
        try {
          const xml = await getXml(url, ctx);
          offers.push(...parseStoreProductOffers(xml, now));
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : "Monitor batch failed");
        }
      }

      // Prefer cheapest store offer per retailer+externalRef (household comparison is chain-level by default).
      const best = new Map<string, AdapterOffer>();
      for (const o of offers) {
        const key = `${o.retailerSlug}|${o.externalRef}`;
        const prev = best.get(key);
        if (!prev || o.price < prev.price) best.set(key, o);
      }
      return { ok: true, offers: [...best.values()], warnings };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Monitor request failed",
        offers: [],
        warnings,
      };
    }
  },
};

/** Test helper: build offers from fixture XML. */
export function offersFromMonitorXml(xml: string, now = new Date()): AdapterOffer[] {
  return parseStoreProductOffers(xml, now);
}
