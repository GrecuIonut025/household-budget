import { addDays, diffDays } from "@/lib/dates";
import type { Minor } from "@/lib/money";

export type EvolutionRange = "7d" | "30d" | "3m" | "12m";

export interface EvolutionPoint {
  date: string;
  cumulativeExpenses: Minor;
  budgetLimit: Minor | null;
}

export interface CategorySlice {
  id: string;
  label: string;
  amount: Minor;
  percent: number;
  color: string;
}

const CATEGORY_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#ec4899",
  "#84cc16",
  "#64748b",
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

/** Build a daily cumulative expense series from ISO dates inclusive. */
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
    cumulative += byDay.get(date) ?? 0;
    points.push({
      date,
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
