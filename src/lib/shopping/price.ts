import { convertQuantity } from "@/lib/units";
import type { PricingMap, ProductPricing } from "@/lib/recipes/pricing";
import type { PricedLineOption, PricedShoppingLine, ShoppingNeed } from "./types";

function lineCost(
  quantity: number,
  unit: NonNullable<ShoppingNeed["unit"]>,
  pricing: ProductPricing,
  itemPriceMinor: number,
): number | null {
  const basis = pricing.basis;
  if (!basis) return null;
  const converted = convertQuantity(quantity, unit, basis.unit, pricing.spec);
  if (!converted.ok) return null;
  return Math.round((converted.value / basis.quantity) * itemPriceMinor);
}

/** Price every shopping need that still has something to buy. Fully covered lines are marked, not priced. */
export function priceShoppingNeeds(needs: readonly ShoppingNeed[], pricing: PricingMap): PricedShoppingLine[] {
  return needs.map((need) => {
    if (need.toBuyQuantity !== null && need.toBuyQuantity <= 0) {
      return { need, options: [], cheapest: null, unknownReason: "fully_covered" };
    }
    if (!need.productId) return { need, options: [], cheapest: null, unknownReason: "no_product" };
    if (need.toBuyQuantity === null || need.unit === null) {
      return { need, options: [], cheapest: null, unknownReason: "no_quantity" };
    }

    const product = pricing[need.productId];
    if (!product || (product.quotes.length === 0 && !product.lastPurchase)) {
      return { need, options: [], cheapest: null, unknownReason: "no_price" };
    }
    if (!product.basis) return { need, options: [], cheapest: null, unknownReason: "no_price_basis" };

    const options: PricedLineOption[] = [];
    for (const quote of product.quotes) {
      const total = lineCost(need.toBuyQuantity, need.unit, product, quote.priceMinor);
      if (total === null) return { need, options: [], cheapest: null, unknownReason: "unit_conversion" };
      const unitPrice = lineCost(1, need.unit, product, quote.priceMinor);
      options.push({
        retailerId: quote.retailerId,
        retailerName: quote.retailerName,
        totalMinor: total,
        unitPriceMinor: unitPrice ?? total,
        isPromo: quote.isPromo,
      });
    }

    if (options.length === 0 && product.lastPurchase) {
      const total = lineCost(need.toBuyQuantity, need.unit, product, product.lastPurchase.unitPriceMinor);
      if (total === null) return { need, options: [], cheapest: null, unknownReason: "unit_conversion" };
      const unitPrice = lineCost(1, need.unit, product, product.lastPurchase.unitPriceMinor);
      const retailerId = product.lastPurchase.retailerId ?? "last-purchase";
      const retailerName = product.lastPurchase.retailerName ?? "Last purchase";
      options.push({
        retailerId,
        retailerName,
        totalMinor: total,
        unitPriceMinor: unitPrice ?? total,
        isPromo: false,
      });
    }

    options.sort((a, b) => a.totalMinor - b.totalMinor || a.retailerName.localeCompare(b.retailerName));
    return { need, options, cheapest: options[0] ?? null, unknownReason: options.length ? null : "no_price" };
  });
}

/** Total of buying every priced line at its cheapest retailer. */
export function cheapestComboTotal(lines: readonly PricedShoppingLine[]): number | null {
  const buyable = lines.filter((l) => l.unknownReason !== "fully_covered" && l.need.toBuyQuantity !== 0);
  const priced = buyable.filter((l) => l.cheapest);
  if (priced.length === 0) return null;
  return priced.reduce((sum, l) => sum + l.cheapest!.totalMinor, 0);
}
