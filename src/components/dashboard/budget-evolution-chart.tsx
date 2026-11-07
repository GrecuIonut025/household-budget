"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import type { EvolutionPoint, EvolutionRange } from "@/lib/dashboard-charts";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/money";

const RANGES: EvolutionRange[] = ["7d", "30d", "3m", "12m"];

export function BudgetEvolutionChart({
  seriesByRange,
  currency,
}: {
  seriesByRange: Record<EvolutionRange, EvolutionPoint[]>;
  currency: string;
}) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<EvolutionRange>("30d");
  const formatAmount = (minor: number) => formatMoney(minor, currency, locale);

  const geometry = useMemo(() => {
    const points = seriesByRange[range] ?? [];
    if (points.length === 0) return null;
    const width = 640;
    const height = 220;
    const padX = 16;
    const padY = 20;
    const maxY = Math.max(
      1,
      ...points.map((p) => p.cumulativeExpenses),
      ...points.map((p) => p.budgetLimit ?? 0),
    );
    const xAt = (i: number) =>
      padX + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (width - padX * 2));
    const yAt = (v: number) => padY + (1 - v / maxY) * (height - padY * 2);

    const spendPath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.cumulativeExpenses).toFixed(1)}`)
      .join(" ");
    const areaPath = `${spendPath} L${xAt(points.length - 1).toFixed(1)},${(height - padY).toFixed(1)} L${xAt(0).toFixed(1)},${(height - padY).toFixed(1)} Z`;

    const budget = points[0]?.budgetLimit;
    const budgetY = budget === null || budget === undefined ? null : yAt(budget);
    const last = points[points.length - 1]!;

    return {
      width,
      height,
      spendPath,
      areaPath,
      budgetY,
      last,
      lastX: xAt(points.length - 1),
      lastY: yAt(last.cumulativeExpenses),
    };
  }, [range, seriesByRange]);

  const rangeLabel = (r: EvolutionRange) => {
    switch (r) {
      case "7d":
        return t("dashboard.range7d");
      case "30d":
        return t("dashboard.range30d");
      case "3m":
        return t("dashboard.range3m");
      case "12m":
        return t("dashboard.range12m");
    }
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] bg-chart-surface p-4 text-sidebar-fg shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-sidebar-fg">{t("dashboard.evolution")}</h2>
        <div className="inline-flex rounded-full bg-white/5 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                range === r ? "bg-brand text-brand-fg" : "text-sidebar-muted hover:text-sidebar-fg",
              )}
            >
              {rangeLabel(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs text-sidebar-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand" />
          {t("dashboard.evolutionBudget")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent-blue" />
          {t("dashboard.evolutionSpent")}
        </span>
      </div>

      {geometry ? (
        <div className="relative">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-auto w-full"
            role="img"
            aria-label={t("dashboard.evolution")}
          >
            <defs>
              <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {geometry.budgetY !== null ? (
              <line
                x1="16"
                x2={geometry.width - 16}
                y1={geometry.budgetY}
                y2={geometry.budgetY}
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 4"
                opacity="0.85"
              />
            ) : null}
            <path d={geometry.areaPath} fill="url(#spendFill)" />
            <path d={geometry.spendPath} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
            <circle cx={geometry.lastX} cy={geometry.lastY} r="4.5" fill="#60a5fa" />
          </svg>
          <div
            className="pointer-events-none absolute rounded-lg bg-white/10 px-2.5 py-1.5 text-xs backdrop-blur"
            style={{
              right: "4%",
              top: `${Math.max(8, (geometry.lastY / geometry.height) * 100 - 12)}%`,
            }}
          >
            <p className="font-semibold tabular text-sidebar-fg">
              {formatAmount(geometry.last.cumulativeExpenses)}
            </p>
            <p className="text-sidebar-muted">{t("common.today")}</p>
          </div>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-sidebar-muted">{t("dashboard.categoriesEmpty")}</p>
      )}
    </section>
  );
}
