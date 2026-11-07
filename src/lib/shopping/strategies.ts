import type {
  BasketCompareInput,
  PricedLineOption,
  PricedShoppingLine,
  StrategyAssignment,
  StrategyKind,
  StrategyResult,
} from "./types";
import { cheapestComboTotal } from "./price";

function buyableLines(lines: readonly PricedShoppingLine[]): PricedShoppingLine[] {
  return lines.filter((l) => l.unknownReason !== "fully_covered" && (l.need.toBuyQuantity === null || l.need.toBuyQuantity > 0));
}

function assignmentFrom(
  line: PricedShoppingLine,
  option: PricedLineOption | null,
): StrategyAssignment {
  return {
    key: line.need.key,
    name: line.need.name,
    productId: line.need.productId,
    quantity: line.need.toBuyQuantity,
    unit: line.need.unit,
    retailerId: option?.retailerId ?? null,
    retailerName: option?.retailerName ?? null,
    totalMinor: option?.totalMinor ?? null,
    unitPriceMinor: option?.unitPriceMinor ?? null,
  };
}

function summarise(
  kind: StrategyKind,
  label: string,
  assignments: StrategyAssignment[],
  expensiveBaseline: number | null,
): StrategyResult {
  const priced = assignments.filter((a) => a.totalMinor !== null && a.retailerId);
  const missingCount = assignments.length - priced.length;
  const byRetailer = new Map<string, { id: string; name: string; totalMinor: number; itemCount: number }>();
  for (const a of priced) {
    const id = a.retailerId!;
    const entry = byRetailer.get(id) ?? { id, name: a.retailerName ?? id, totalMinor: 0, itemCount: 0 };
    entry.totalMinor += a.totalMinor!;
    entry.itemCount += 1;
    byRetailer.set(id, entry);
  }
  const totalMinor = priced.length ? priced.reduce((s, a) => s + (a.totalMinor ?? 0), 0) : null;
  const savingsMinor =
    totalMinor !== null && expensiveBaseline !== null && expensiveBaseline > totalMinor
      ? expensiveBaseline - totalMinor
      : 0;

  return {
    kind,
    label,
    totalMinor,
    retailerCount: byRetailer.size,
    retailers: [...byRetailer.values()].sort((a, b) => a.name.localeCompare(b.name)),
    missingCount,
    assignments,
    savingsMinor,
  };
}

function optionForRetailer(line: PricedShoppingLine, retailerId: string): PricedLineOption | null {
  return line.options.find((o) => o.retailerId === retailerId) ?? null;
}

/** Complete single-retailer baskets (cover every priced line), cheapest first. */
export function singleRetailerBaskets(lines: readonly PricedShoppingLine[]): {
  retailerId: string;
  retailerName: string;
  totalMinor: number;
  missingCount: number;
}[] {
  const buyable = buyableLines(lines).filter((l) => l.options.length > 0);
  if (buyable.length === 0) return [];

  const retailers = new Map<string, { name: string; total: number; covered: number }>();
  for (const line of buyable) {
    for (const option of line.options) {
      const entry = retailers.get(option.retailerId) ?? { name: option.retailerName, total: 0, covered: 0 };
      entry.total += option.totalMinor;
      entry.covered += 1;
      retailers.set(option.retailerId, entry);
    }
  }

  return [...retailers.entries()]
    .map(([retailerId, e]) => ({
      retailerId,
      retailerName: e.name,
      totalMinor: e.total,
      missingCount: buyable.length - e.covered,
    }))
    .sort((a, b) => a.missingCount - b.missingCount || a.totalMinor - b.totalMinor || a.retailerName.localeCompare(b.retailerName));
}

function expensiveBaseline(lines: readonly PricedShoppingLine[], override?: number | null): number | null {
  if (override !== null && override !== undefined) return override;
  const complete = singleRetailerBaskets(lines).filter((b) => b.missingCount === 0);
  if (complete.length === 0) {
    // fall back to sum of each line's dearest option
    const buyable = buyableLines(lines).filter((l) => l.options.length > 0);
    if (buyable.length === 0) return null;
    return buyable.reduce((s, l) => s + l.options[l.options.length - 1].totalMinor, 0);
  }
  return Math.max(...complete.map((b) => b.totalMinor));
}

function cheapestSingle(lines: readonly PricedShoppingLine[], baseline: number | null): StrategyResult {
  const buyable = buyableLines(lines);
  const baskets = singleRetailerBaskets(lines);
  const best = baskets.find((b) => b.missingCount === 0) ?? baskets[0];
  if (!best) {
    return summarise(
      "cheapest_single",
      "Cheapest single supermarket",
      buyable.map((l) => assignmentFrom(l, null)),
      baseline,
    );
  }
  const assignments = buyable.map((l) => assignmentFrom(l, optionForRetailer(l, best.retailerId)));
  return summarise("cheapest_single", "Cheapest single supermarket", assignments, baseline);
}

function cheapestCombo(lines: readonly PricedShoppingLine[], baseline: number | null): StrategyResult {
  const buyable = buyableLines(lines);
  const assignments = buyable.map((l) => assignmentFrom(l, l.cheapest));
  return summarise("cheapest_combo", "Cheapest combination", assignments, baseline);
}

function preferred(
  lines: readonly PricedShoppingLine[],
  preferredRetailerId: string | null | undefined,
  baseline: number | null,
): StrategyResult {
  const buyable = buyableLines(lines);
  if (!preferredRetailerId) {
    return summarise(
      "preferred",
      "Preferred supermarket",
      buyable.map((l) => assignmentFrom(l, null)),
      baseline,
    );
  }
  const assignments = buyable.map((l) => {
    const preferredOpt = optionForRetailer(l, preferredRetailerId);
    return assignmentFrom(l, preferredOpt ?? l.cheapest);
  });
  return summarise("preferred", "Preferred supermarket", assignments, baseline);
}

/**
 * Minimise supermarket visits: greedily cover remaining items with the retailer that
 * covers the most still-unassigned priced lines (tie-break: lower added cost).
 */
function minVisits(lines: readonly PricedShoppingLine[], baseline: number | null): StrategyResult {
  const buyable = buyableLines(lines);
  const remaining = new Set(buyable.filter((l) => l.options.length > 0).map((l) => l.need.key));
  const chosen = new Map<string, PricedLineOption>();

  while (remaining.size > 0) {
    const retailers = new Map<string, { name: string; cover: string[]; cost: number }>();
    for (const line of buyable) {
      if (!remaining.has(line.need.key)) continue;
      for (const option of line.options) {
        const entry = retailers.get(option.retailerId) ?? { name: option.retailerName, cover: [], cost: 0 };
        entry.cover.push(line.need.key);
        entry.cost += option.totalMinor;
        retailers.set(option.retailerId, entry);
      }
    }
    if (retailers.size === 0) break;

    let bestId: string | null = null;
    let best: { name: string; cover: string[]; cost: number } | null = null;
    for (const [id, entry] of retailers) {
      if (
        !best ||
        entry.cover.length > best.cover.length ||
        (entry.cover.length === best.cover.length && entry.cost < best.cost) ||
        (entry.cover.length === best.cover.length && entry.cost === best.cost && entry.name.localeCompare(best.name) < 0)
      ) {
        bestId = id;
        best = entry;
      }
    }
    if (!bestId || !best) break;

    for (const line of buyable) {
      if (!remaining.has(line.need.key)) continue;
      const opt = optionForRetailer(line, bestId);
      if (opt) {
        chosen.set(line.need.key, opt);
        remaining.delete(line.need.key);
      }
    }
  }

  const assignments = buyable.map((l) => assignmentFrom(l, chosen.get(l.need.key) ?? l.cheapest));
  return summarise("min_visits", "Minimise visits", assignments, baseline);
}

/** Compare the basket across the four shopping strategies and report savings. */
export function compareStrategies(input: BasketCompareInput): StrategyResult[] {
  const baseline = expensiveBaseline(input.lines, input.expensiveBaselineMinor);
  return [
    cheapestSingle(input.lines, baseline),
    cheapestCombo(input.lines, baseline),
    preferred(input.lines, input.preferredRetailerId, baseline),
    minVisits(input.lines, baseline),
  ];
}

export function strategyTotal(kind: StrategyKind, lines: readonly PricedShoppingLine[], preferredRetailerId?: string | null): number | null {
  const results = compareStrategies({ lines, pricing: {}, preferredRetailerId });
  return results.find((r) => r.kind === kind)?.totalMinor ?? null;
}

export { cheapestComboTotal };
