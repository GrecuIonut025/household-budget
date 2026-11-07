import { describe, expect, it } from "vitest";
import { buildCategorySlices, buildEvolutionSeries, rangeStart } from "./dashboard-charts";

describe("dashboard charts", () => {
  it("computes range starts inclusively", () => {
    expect(rangeStart("2026-11-07", "7d")).toBe("2026-11-01");
    expect(rangeStart("2026-11-07", "30d")).toBe("2026-10-09");
  });

  it("accumulates expenses day by day and keeps daily amounts", () => {
    const series = buildEvolutionSeries({
      today: "2026-11-03",
      range: "7d",
      budgetLimit: 10_000,
      expenses: [
        { occurredOn: "2026-11-01", amount: 100 },
        { occurredOn: "2026-11-03", amount: 50 },
        { occurredOn: "2026-10-01", amount: 999 },
      ],
    });
    expect(series).toHaveLength(7);
    expect(series[0]).toMatchObject({ date: "2026-10-28", dailyExpenses: 0, cumulativeExpenses: 0 });
    expect(series.find((p) => p.date === "2026-11-01")).toMatchObject({
      dailyExpenses: 100,
      cumulativeExpenses: 100,
    });
    expect(series.at(-1)).toMatchObject({ date: "2026-11-03", dailyExpenses: 50, cumulativeExpenses: 150 });
  });

  it("builds category percentages from real totals", () => {
    const slices = buildCategorySlices([
      { id: "a", label: "Food", amount: 400 },
      { id: "b", label: "Transport", amount: 100 },
    ]);
    expect(slices[0]).toMatchObject({ id: "a", percent: 80, color: "#8b5cf6" });
    expect(slices[1]).toMatchObject({ id: "b", percent: 20 });
    expect(buildCategorySlices([])).toEqual([]);
  });
});
