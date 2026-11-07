import { fetchOpenFoodFacts, type OffProduct } from "@/lib/products/open-food-facts";
import type { AdapterOffer } from "../types";
import { DEFAULT_USER_AGENT, type AdapterContext, type AdapterFetchInput, type AdapterResult, type PriceAdapter } from "./types";

/**
 * Open Food Facts adapter — metadata only (EAN → name/brand/size). It never yields prices.
 * Used to enrich matching when the household scans a barcode; quotes stay empty by design.
 */
export function offProductToMetadataOffer(product: OffProduct, observedAt: string): AdapterOffer {
  return {
    adapter: "open_food_facts",
    retailerSlug: "unknown",
    externalRef: `off:${product.barcode}`,
    nameRaw: product.name,
    brandRaw: product.brand,
    unitRaw:
      product.packageSize && product.packageUnit ? `${product.packageSize} ${product.packageUnit}` : null,
    categoryRaw: null,
    // Placeholder rejected by ingest — OFF has no prices. Kept at -1 so callers can filter.
    price: -1,
    currency: "RON",
    isPromo: false,
    loyaltyRequired: false,
    gtin: product.barcode,
    observedAt,
    sourceUrl: product.sourceUrl,
    storeExternalId: null,
    storeName: null,
  };
}

export const openFoodFactsAdapter: PriceAdapter = {
  id: "open_food_facts",
  label: "Open Food Facts (metadata)",
  async fetchOffers(input: AdapterFetchInput, ctx: AdapterContext = {}): Promise<AdapterResult> {
    const warnings: string[] = [];
    const now = (ctx.now ?? new Date()).toISOString();
    const gtins = input.gtins ?? [];
    if (gtins.length === 0) {
      return { ok: false, error: "No GTINs provided", offers: [], warnings };
    }
    const offers: AdapterOffer[] = [];
    for (const gtin of gtins.slice(0, 15)) {
      const result = await fetchOpenFoodFacts(gtin, {
        fetchImpl: ctx.fetchImpl,
        userAgent: ctx.userAgent ?? DEFAULT_USER_AGENT,
      });
      if (result.status === "found") {
        offers.push(offProductToMetadataOffer(result.product, now));
      } else if (result.status === "rate_limited") {
        warnings.push("Open Food Facts rate limit reached.");
        break;
      } else if (result.status === "unavailable") {
        warnings.push(`Open Food Facts unavailable for ${gtin}.`);
      }
    }
    // Never emit price offers — OFF is metadata only (see lookupOffMetadata).
    return {
      ok: true,
      offers: [],
      warnings: [
        ...warnings,
        ...(offers.length
          ? [`Resolved metadata for ${offers.length} barcode(s); OFF does not provide prices.`]
          : []),
      ],
    };
  },
};

/** Direct metadata lookup used by matching enrichment (not a price source). */
export async function lookupOffMetadata(
  gtins: string[],
  ctx: AdapterContext = {},
): Promise<OffProduct[]> {
  const out: OffProduct[] = [];
  for (const gtin of gtins.slice(0, 15)) {
    const result = await fetchOpenFoodFacts(gtin, {
      fetchImpl: ctx.fetchImpl,
      userAgent: ctx.userAgent ?? DEFAULT_USER_AGENT,
    });
    if (result.status === "found") out.push(result.product);
    if (result.status === "rate_limited") break;
  }
  return out;
}
