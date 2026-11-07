import { addDays, diffDays } from "@/lib/dates";
import type { Minor } from "@/lib/money";

export type EvolutionRange = "7d" | "30d" | "3m" | "12m";

export interface EvolutionPoint {
  date: string;
  /** Spend on this calendar day only. */
  dailyExpenses: Minor;
  /** Running total from range start through this day. */
  cumulativeExpenses: Minor;
  /** Optional horizontal guide (e.g. period spending limit). */
  budgetLimit: Minor | null;
}

export interface CategorySlice {
  id: string;
  label: string;
  amount: Minor;
  percent: number;
  color: string;
}

/** Match Bugetify HTML donut: violet, cyan, amber, emerald, slate… */
const CATEGORY_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#64748b",
  "#ef4444",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
];

export function rangeStart(today: string, range: EvolutionRange): string {
  switch (range) {
    case "7d":
      return addDays(today, -6);
    case "30d":
      return addDays(today, -29);
    case "3m":
      return addDays(today, -89);
    case "12m":
      return addDays(today, -364);
  }
}

/** Build a daily expense series (bars) plus cumulative totals from ISO dates inclusive. */
export function buildEvolutionSeries(input: {
  today: string;
  range: EvolutionRange;
  expenses: readonly { occurredOn: string; amount: Minor }[];
  budgetLimit: Minor | null;
}): EvolutionPoint[] {
  const start = rangeStart(input.today, input.range);
  const days = diffDays(start, input.today) + 1;
  const byDay = new Map<string, Minor>();
  for (const e of input.expenses) {
    if (e.occurredOn < start || e.occurredOn > input.today) continue;
    byDay.set(e.occurredOn, (byDay.get(e.occurredOn) ?? 0) + e.amount);
  }

  const points: EvolutionPoint[] = [];
  let cumulative = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const daily = byDay.get(date) ?? 0;
    cumulative += daily;
    points.push({
      date,
      dailyExpenses: daily,
      cumulativeExpenses: cumulative,
      budgetLimit: input.budgetLimit,
    });
  }
  return points;
}

export function buildCategorySlices(
  rows: readonly { id: string; label: string; amount: Minor }[],
): CategorySlice[] {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total <= 0) return [];
  return [...rows]
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((r, i) => ({
      id: r.id,
      label: r.label,
      amount: r.amount,
      percent: Math.round((r.amount / total) * 100),
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
    }));
}
