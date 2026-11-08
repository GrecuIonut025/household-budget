import type {
  GlovoComparisonGroup,
  GlovoMarket,
  GlovoProduct,
  GlovoQuote,
  GlovoRetailerKey,
} from "./types";

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function groupKey(product: GlovoProduct): string {
  const ean = product.eans.find((e) => e && e.length >= 8);
  if (ean) return `ean:${ean}`;
  return `name:${normalizeName(product.name)}`;
}

export function buildGlovoComparison(
  products: GlovoProduct[],
  markets: GlovoMarket[],
): GlovoComparisonGroup[] {
  const marketByKey = new Map(markets.map((m) => [m.retailer_key, m]));
  const groups = new Map<string, GlovoComparisonGroup>();

  for (const product of products) {
    if (product.price == null || !Number.isFinite(Number(product.price))) continue;
    const market = marketByKey.get(product.retailer_key);
    if (!market) continue;

    const key = groupKey(product);
    const quote: GlovoQuote = {
      productId: product.id,
      retailerKey: product.retailer_key,
      marketName: market.name,
      brandColor: market.brand_color,
      logoEmoji: market.logo_emoji,
      price: Number(product.price),
      currency: product.currency || "RON",
      priceDisplay: product.price_display,
      imageUrl: product.image_url,
      outOfStock: product.out_of_stock,
      category: product.category,
    };

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        name: product.name,
        imageUrl: product.image_url,
        category: product.category,
        eans: [...product.eans],
        quotes: [quote],
        cheapestRetailerKey: product.retailer_key,
        spread: null,
      });
      continue;
    }

    // Prefer keeping one quote per retailer (cheapest in-stock wins).
    const priorIdx = existing.quotes.findIndex((q) => q.retailerKey === quote.retailerKey);
    if (priorIdx >= 0) {
      const prior = existing.quotes[priorIdx]!;
      if (quote.price < prior.price || (prior.outOfStock && !quote.outOfStock)) {
        existing.quotes[priorIdx] = quote;
      }
    } else {
      existing.quotes.push(quote);
    }
    if (!existing.imageUrl && quote.imageUrl) existing.imageUrl = quote.imageUrl;
    for (const ean of product.eans) {
      if (ean && !existing.eans.includes(ean)) existing.eans.push(ean);
    }
  }

  const result: GlovoComparisonGroup[] = [];
  for (const group of groups.values()) {
    group.quotes.sort((a, b) => a.price - b.price);
    const inStock = group.quotes.filter((q) => !q.outOfStock);
    const ranked = inStock.length > 0 ? inStock : group.quotes;
    group.cheapestRetailerKey = (ranked[0]?.retailerKey ?? null) as GlovoRetailerKey | null;
    if (ranked.length >= 2) {
      group.spread = ranked[ranked.length - 1]!.price - ranked[0]!.price;
    }
    result.push(group);
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

export function filterGlovoGroups(
  groups: GlovoComparisonGroup[],
  query: string,
  retailer?: GlovoRetailerKey | null,
): GlovoComparisonGroup[] {
  const q = query.trim().toLowerCase();
  return groups.filter((group) => {
    if (retailer && !group.quotes.some((quote) => quote.retailerKey === retailer)) {
      return false;
    }
    if (!q) return true;
    if (group.name.toLowerCase().includes(q)) return true;
    if (group.category?.toLowerCase().includes(q)) return true;
    if (group.eans.some((ean) => ean.includes(q))) return true;
    return group.quotes.some((quote) => quote.marketName.toLowerCase().includes(q));
  });
}
