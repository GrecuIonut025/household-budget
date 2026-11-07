import { parseUnit, type Unit, type UnitSpec } from "@/lib/units";

/** What one priced item of a product contains, e.g. 500 g of pasta or 10 eggs. */
export interface PriceBasis {
  quantity: number;
  unit: Unit;
}

export interface RetailerQuote {
  retailerId: string;
  retailerName: string;
  /** price of one item (one `basis`), in minor units of the household currency */
  priceMinor: number;
  isPromo: boolean;
  /** ISO timestamp of the observation */
  observedAt: string | null;
}

/** Last price the household actually paid for one item (one `basis`). Always labelled as a fallback in the UI. */
export interface LastPurchase {
  unitPriceMinor: number;
  purchasedOn: string | null;
  retailerId: string | null;
  retailerName: string | null;
}

export interface ProductPricing {
  productId: string;
  /** null when the price cannot be tied to a quantity (e.g. a "pack" with unknown content) */
  basis: PriceBasis | null;
  spec: UnitSpec;
  quotes: RetailerQuote[];
  lastPurchase: LastPurchase | null;
}

/**
 * The only thing the cost calculator knows about prices. The retailer adapters worker fills `product_prices`;
 * any implementation (database, fixtures, cache) can sit behind this interface.
 */
export interface PricingLookup {
  getPricing(productIds: readonly string[]): Promise<ProductPricing[]>;
}

export type PricingMap = Record<string, ProductPricing>;

export async function lookupPricing(lookup: PricingLookup, productIds: readonly string[]): Promise<PricingMap> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return {};
  const rows = await lookup.getPricing(unique);
  return Object.fromEntries(rows.map((r) => [r.productId, r]));
}

export interface ProductPackaging {
  unit: string;
  package_size: number | null;
  package_unit: string | null;
}

/** Derives what one item of a product contains. Returns null instead of guessing. */
export function priceBasisFromProduct(product: ProductPackaging): PriceBasis | null {
  const packageUnit = parseUnit(product.package_unit);
  if (product.package_size && product.package_size > 0 && packageUnit) {
    return { quantity: product.package_size, unit: packageUnit };
  }
  const unit = parseUnit(product.unit);
  return unit ? { quantity: 1, unit } : null;
}
