import { AUTO_LINK_THRESHOLD, type ComparisonQuote, type ComparisonRow } from "./types";

export function quoteNeedsReview(q: Pick<ComparisonQuote, "source" | "matchConfidence" | "isVerified">): boolean {
  if (q.source === "manual" || q.isVerified) return false;
  return q.matchConfidence === null || q.matchConfidence < AUTO_LINK_THRESHOLD;
}

/** Groups current quotes by product and ranks retailers cheapest-first. Drops non-positive prices. */
export function buildComparison(
  products: readonly { id: string; name: string; brand: string | null }[],
  quotes: readonly ComparisonQuote[],
): ComparisonRow[] {
  const byProduct = new Map<string, ComparisonQuote[]>();
  for (const q of quotes) {
    if (!(q.price > 0)) continue;
    const list = byProduct.get(q.productId) ?? [];
    list.push({ ...q, needsReview: quoteNeedsReview(q) });
    byProduct.set(q.productId, list);
  }

  return products.map((p) => {
    const list = [...(byProduct.get(p.id) ?? [])].sort(
      (a, b) => a.price - b.price || a.retailerName.localeCompare(b.retailerName),
    );
    const cheapest = list[0] ?? null;
    const dearest = list.length > 1 ? list[list.length - 1] : null;
    return {
      productId: p.id,
      productName: p.name,
      brand: p.brand,
      cheapest,
      quotes: list,
      spread: cheapest && dearest ? Number((dearest.price - cheapest.price).toFixed(2)) : null,
    };
  });
}

/** Savings if buying the cheapest quote instead of a preferred/last retailer quote. */
export function potentialSaving(preferredPrice: number | null, cheapest: number | null): number | null {
  if (preferredPrice === null || cheapest === null) return null;
  if (!(preferredPrice > 0) || !(cheapest > 0)) return null;
  const delta = Number((preferredPrice - cheapest).toFixed(2));
  return delta > 0 ? delta : null;
}
