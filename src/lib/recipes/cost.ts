import { convertQuantity, type ConversionError, type Unit } from "@/lib/units";
import type { PricingMap, ProductPricing } from "./pricing";
import { scaleFactor } from "./scaling";

/**
 * Recipe cost calculator (pure, integer minor units).
 *
 * - An ingredient is priced proportionally: the quantity used times the price per unit of the priced item.
 * - Retailer prices (product_prices) win; the household's last purchase price is used only when no retailer
 *   price is usable and is always reported with `source.kind === "last_purchase"`.
 * - Anything that cannot be priced is `unknown` with a reason. Nothing is estimated or defaulted.
 */

export interface SubstitutionInput {
  id: string;
  name: string;
  productId: string | null;
  /** null quantity and unit mean "same amount as the ingredient it replaces" */
  quantity: number | null;
  unit: Unit | null;
}

export interface IngredientInput {
  id: string;
  name: string;
  productId: string | null;
  quantity: number | null;
  unit: Unit | null;
  isOptional: boolean;
  /** user says it is already in the kitchen */
  isAtHome: boolean;
  /** free text shown next to the ingredient; not used for pricing */
  note?: string | null;
  substitutions: SubstitutionInput[];
}

export interface PantryStock {
  productId: string;
  quantity: number;
  unit: Unit | null;
}

export interface CostInput {
  baseServings: number;
  targetServings: number;
  ingredients: readonly IngredientInput[];
  pricing: PricingMap;
  pantry?: readonly PantryStock[];
  /** optional ingredients are shown but not counted unless this is true */
  includeOptional?: boolean;
}

export type UnknownReason = "no_product" | "no_quantity" | "no_price" | "no_price_basis" | "unit_conversion";

export interface CostSource {
  kind: "retailer" | "last_purchase";
  retailerId: string | null;
  retailerName: string | null;
  isPromo: boolean;
  /** observation timestamp (retailer) or purchase date (last purchase) */
  asOf: string | null;
}

export interface IngredientCost {
  minor: number;
  source: CostSource;
}

export interface PriceOption {
  retailerId: string;
  retailerName: string;
  minor: number;
  isPromo: boolean;
  observedAt: string | null;
}

export interface SubstitutionCost {
  id: string;
  name: string;
  productId: string | null;
  quantity: number | null;
  unit: Unit | null;
  cost: IngredientCost | null;
  unknownReason: UnknownReason | null;
  /** substitute cost minus the ingredient's cost; negative means cheaper. null when either is unknown */
  deltaMinor: number | null;
}

export type Coverage = "at_home" | "pantry" | "partial_pantry";

export interface IngredientLine {
  id: string;
  name: string;
  productId: string | null;
  isOptional: boolean;
  isAtHome: boolean;
  note: string | null;
  /** false for optional ingredients that are excluded from totals */
  counted: boolean;
  /** quantity scaled to the target servings */
  quantity: number | null;
  unit: Unit | null;
  cost: IngredientCost | null;
  unknownReason: UnknownReason | null;
  conversionError: ConversionError | null;
  /** every retailer that can be priced for this ingredient, cheapest first */
  options: PriceOption[];
  /** dearest retailer option minus cheapest; 0 with fewer than two options */
  savingsMinor: number;
  coverage: Coverage | null;
  /** 0..1, how much of the quantity is already available at home */
  coveredFraction: number;
  /** cost of what still has to be bought; null when the cost is unknown */
  toBuyMinor: number | null;
  substitutions: SubstitutionCost[];
}

export interface RetailerBasket {
  retailerId: string;
  retailerName: string;
  totalMinor: number;
  /** ingredients (with a retailer price somewhere) this retailer cannot price */
  missingCount: number;
}

export interface RecipeCost {
  servings: number;
  scale: number;
  lines: IngredientLine[];
  /** sum of known costs of counted ingredients; null when none could be priced */
  totalMinor: number | null;
  perServingMinor: number | null;
  /** same, for what still has to be bought (at-home and pantry stock excluded) */
  toBuyMinor: number | null;
  toBuyPerServingMinor: number | null;
  /** counted ingredients without a cost */
  unknownCount: number;
  /** counted ingredients without a cost that are not fully covered at home */
  toBuyUnknownCount: number;
  complete: boolean;
  /** at least one counted cost comes from the last purchase instead of a retailer price */
  usesLastPurchase: boolean;
  /** sum of per-ingredient savings: cheapest retailer per ingredient vs the dearest one */
  savingsMinor: number;
  /** cost of buying every retailer-priced ingredient at its cheapest retailer */
  cheapestMixedMinor: number | null;
  /** single-retailer baskets that cover every retailer-priced ingredient, cheapest first */
  baskets: RetailerBasket[];
  /** partial single-retailer baskets (some ingredients not stocked), cheapest first */
  partialBaskets: RetailerBasket[];
}

interface Priced {
  cost: IngredientCost | null;
  options: PriceOption[];
  unknownReason: UnknownReason | null;
  conversionError: ConversionError | null;
}

function itemCost(
  quantity: number,
  unit: Unit,
  pricing: ProductPricing,
  itemPriceMinor: number,
): { minor: number } | { error: ConversionError } {
  const basis = pricing.basis;
  if (!basis) throw new Error("itemCost requires a price basis");
  const converted = convertQuantity(quantity, unit, basis.unit, pricing.spec);
  if (!converted.ok) return { error: converted.error };
  return { minor: Math.round((converted.value / basis.quantity) * itemPriceMinor) };
}

function priceQuantity(productId: string | null, quantity: number | null, unit: Unit | null, pricingMap: PricingMap): Priced {
  const unknown = (unknownReason: UnknownReason, conversionError: ConversionError | null = null): Priced => ({
    cost: null,
    options: [],
    unknownReason,
    conversionError,
  });
  if (!productId) return unknown("no_product");
  if (quantity === null || unit === null) return unknown("no_quantity");
  const pricing = pricingMap[productId];
  if (!pricing || (pricing.quotes.length === 0 && !pricing.lastPurchase)) return unknown("no_price");
  if (!pricing.basis) return unknown("no_price_basis");

  let conversionError: ConversionError | null = null;
  const options: PriceOption[] = [];
  for (const quote of pricing.quotes) {
    const result = itemCost(quantity, unit, pricing, quote.priceMinor);
    if ("error" in result) {
      conversionError = result.error;
      break;
    }
    options.push({
      retailerId: quote.retailerId,
      retailerName: quote.retailerName,
      minor: result.minor,
      isPromo: quote.isPromo,
      observedAt: quote.observedAt,
    });
  }
  if (conversionError) return unknown("unit_conversion", conversionError);

  options.sort((a, b) => a.minor - b.minor || a.retailerName.localeCompare(b.retailerName));
  const cheapest = options[0];
  if (cheapest) {
    return {
      cost: {
        minor: cheapest.minor,
        source: {
          kind: "retailer",
          retailerId: cheapest.retailerId,
          retailerName: cheapest.retailerName,
          isPromo: cheapest.isPromo,
          asOf: cheapest.observedAt,
        },
      },
      options,
      unknownReason: null,
      conversionError: null,
    };
  }

  const last = pricing.lastPurchase;
  if (!last) return unknown("no_price");
  const result = itemCost(quantity, unit, pricing, last.unitPriceMinor);
  if ("error" in result) return unknown("unit_conversion", result.error);
  return {
    cost: {
      minor: result.minor,
      source: {
        kind: "last_purchase",
        retailerId: last.retailerId,
        retailerName: last.retailerName,
        isPromo: false,
        asOf: last.purchasedOn,
      },
    },
    options: [],
    unknownReason: null,
    conversionError: null,
  };
}

function coverageFor(
  ingredient: IngredientInput,
  quantity: number | null,
  unit: Unit | null,
  pricingMap: PricingMap,
  pantry: readonly PantryStock[],
): { coverage: Coverage | null; fraction: number } {
  if (ingredient.isAtHome) return { coverage: "at_home", fraction: 1 };
  if (!ingredient.productId || quantity === null || unit === null || quantity <= 0) return { coverage: null, fraction: 0 };
  const spec = pricingMap[ingredient.productId]?.spec ?? {};
  let available = 0;
  for (const stock of pantry) {
    if (stock.productId !== ingredient.productId || stock.unit === null || stock.quantity <= 0) continue;
    const converted = convertQuantity(stock.quantity, stock.unit, unit, spec);
    if (converted.ok) available += converted.value;
  }
  if (available <= 0) return { coverage: null, fraction: 0 };
  const fraction = Math.min(1, available / quantity);
  return { coverage: fraction >= 1 ? "pantry" : "partial_pantry", fraction };
}

export function computeRecipeCost(input: CostInput): RecipeCost {
  const factor = scaleFactor(input.baseServings, input.targetServings);
  const pantry = input.pantry ?? [];
  const scaled = (q: number | null) => (q === null ? null : Number((q * factor).toPrecision(12)));

  const lines: IngredientLine[] = input.ingredients.map((ing) => {
    const quantity = scaled(ing.quantity);
    const priced = priceQuantity(ing.productId, quantity, ing.unit, input.pricing);
    const { coverage, fraction } = coverageFor(ing, quantity, ing.unit, input.pricing, pantry);
    const cost = priced.cost;
    const options = priced.options;

    const substitutions: SubstitutionCost[] = ing.substitutions.map((sub) => {
      const subQuantity = sub.quantity === null ? quantity : scaled(sub.quantity);
      const subUnit = sub.quantity === null ? ing.unit : sub.unit;
      const subPriced = priceQuantity(sub.productId, subQuantity, subUnit, input.pricing);
      return {
        id: sub.id,
        name: sub.name,
        productId: sub.productId,
        quantity: subQuantity,
        unit: subUnit,
        cost: subPriced.cost,
        unknownReason: subPriced.unknownReason,
        deltaMinor: subPriced.cost && cost ? subPriced.cost.minor - cost.minor : null,
      };
    });

    return {
      id: ing.id,
      name: ing.name,
      productId: ing.productId,
      isOptional: ing.isOptional,
      isAtHome: ing.isAtHome,
      note: ing.note ?? null,
      counted: !ing.isOptional || input.includeOptional === true,
      quantity,
      unit: ing.unit,
      cost,
      unknownReason: priced.unknownReason,
      conversionError: priced.conversionError,
      options,
      savingsMinor: options.length > 1 ? options[options.length - 1].minor - options[0].minor : 0,
      coverage,
      coveredFraction: fraction,
      toBuyMinor: cost ? Math.round(cost.minor * (1 - fraction)) : null,
      substitutions,
    };
  });

  const counted = lines.filter((l) => l.counted);
  const priced = counted.filter((l) => l.cost);
  const unknown = counted.filter((l) => !l.cost);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const totalMinor = priced.length ? sum(priced.map((l) => l.cost!.minor)) : null;
  const toBuyMinor = priced.length ? sum(priced.map((l) => l.toBuyMinor!)) : null;
  const perServing = (n: number | null) => (n === null ? null : Math.round(n / input.targetServings));

  const basketLines = counted.filter((l) => l.options.length > 0);
  const retailers = new Map<string, { name: string; total: number; covered: number }>();
  for (const line of basketLines) {
    for (const option of line.options) {
      const entry = retailers.get(option.retailerId) ?? { name: option.retailerName, total: 0, covered: 0 };
      entry.total += option.minor;
      entry.covered += 1;
      retailers.set(option.retailerId, entry);
    }
  }
  const allBaskets: RetailerBasket[] = [...retailers.entries()]
    .map(([retailerId, e]) => ({
      retailerId,
      retailerName: e.name,
      totalMinor: e.total,
      missingCount: basketLines.length - e.covered,
    }))
    .sort((a, b) => a.totalMinor - b.totalMinor || a.retailerName.localeCompare(b.retailerName));

  return {
    servings: input.targetServings,
    scale: factor,
    lines,
    totalMinor,
    perServingMinor: perServing(totalMinor),
    toBuyMinor,
    toBuyPerServingMinor: perServing(toBuyMinor),
    unknownCount: unknown.length,
    toBuyUnknownCount: unknown.filter((l) => l.coveredFraction < 1).length,
    complete: unknown.length === 0 && counted.length > 0,
    usesLastPurchase: priced.some((l) => l.cost!.source.kind === "last_purchase"),
    savingsMinor: sum(counted.map((l) => l.savingsMinor)),
    cheapestMixedMinor: basketLines.length ? sum(basketLines.map((l) => l.options[0].minor)) : null,
    baskets: allBaskets.filter((b) => b.missingCount === 0),
    partialBaskets: allBaskets.filter((b) => b.missingCount > 0),
  };
}
