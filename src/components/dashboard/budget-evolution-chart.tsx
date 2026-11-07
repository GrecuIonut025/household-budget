"use client";

import clsx from "clsx";
import { ChartNoAxesColumn } from "lucide-react";
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
    const width = 640;
    const height = 220;
    const padX = 16;
    const padY = 24;
    const hasActivity = points.some((p) => p.cumulativeExpenses > 0 || p.dailyExpenses > 0);
    if (points.length === 0 || !hasActivity) {
      return { width, height, padX, padY, empty: true as const, points: [] as EvolutionPoint[] };
    }
    const maxY = Math.max(
      1,
      ...points.map((p) => p.cumulativeExpenses),
      ...points.map((p) => p.budgetLimit ?? 0),
      ...points.map((p) => p.dailyExpenses),
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

    // Daily bars under the cumulative line for denser chrome.
    const gap = points.length > 40 ? 1 : points.length > 20 ? 2 : 3;
    const innerW = width - padX * 2;
    const barW = Math.max(2, (innerW - gap * (points.length - 1)) / points.length);

    return {
      width,
      height,
      padX,
      padY,
      empty: false as const,
      points,
      spendPath,
      areaPath,
      budgetY,
      last,
      lastX: xAt(points.length - 1),
      lastY: yAt(last.cumulativeExpenses),
      barW,
      gap,
      yAt,
      xAt,
      maxY,
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
    <section className="min-h-[20rem] overflow-hidden rounded-[var(--radius-lg)] bg-chart-surface p-4 text-sidebar-fg shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-sidebar-fg">
          <ChartNoAxesColumn size={16} aria-hidden className="text-brand" />
          {t("dashboard.evolution")}
        </h2>
        <div className="inline-flex rounded-full bg-white/5 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                range === r ? "brand-gradient text-brand-fg" : "text-sidebar-muted hover:text-sidebar-fg",
              )}
            >
              {rangeLabel(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs text-sidebar-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent-blue" />
          {t("dashboard.evolutionSpent")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed border-ok" />
          {t("dashboard.evolutionBudget")}
        </span>
      </div>

      {!geometry.empty ? (
        <div className="relative">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-auto w-full"
            role="img"
            aria-label={t("dashboard.evolution")}
          >
            <defs>
              <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            {geometry.points.map((p, i) => {
              const x = geometry.padX + i * (geometry.barW + geometry.gap);
              const h = Math.max(0, geometry.yAt(0) - geometry.yAt(p.dailyExpenses));
              return (
                <rect
                  key={p.date}
                  x={x}
                  y={geometry.yAt(p.dailyExpenses)}
                  width={geometry.barW}
                  height={h}
                  rx={Math.min(3, geometry.barW / 2)}
                  fill="url(#barFill)"
                  opacity={0.45}
                />
              );
            })}
            {geometry.budgetY !== null ? (
              <line
                x1={geometry.padX}
                x2={geometry.width - geometry.padX}
                y1={geometry.budgetY}
                y2={geometry.budgetY}
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="5 5"
                opacity="0.9"
              />
            ) : null}
            <path d={geometry.areaPath} fill="url(#spendFill)" />
            <path d={geometry.spendPath} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
            <circle cx={geometry.lastX} cy={geometry.lastY} r="4.5" fill="#60a5fa" />
          </svg>
          <div className="pointer-events-none absolute right-[4%] top-[8%] rounded-lg bg-white/10 px-2.5 py-1.5 text-xs backdrop-blur">
            <p className="font-semibold tabular text-sidebar-fg">
              {formatAmount(geometry.last.cumulativeExpenses)}
            </p>
            <p className="text-sidebar-muted">{t("common.today")}</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox="0 0 640 220" className="h-auto w-full" aria-hidden>
            {[40, 80, 120, 160].map((y) => (
              <line key={y} x1="16" x2="624" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
            ))}
            <line x1="16" x2="624" y1="100" y2="100" stroke="#34d399" strokeWidth="2" strokeDasharray="5 5" opacity="0.35" />
          </svg>
          <p className="absolute inset-0 flex items-center justify-center text-sm text-sidebar-muted">
            {t("dashboard.categoriesEmpty")}
          </p>
        </div>
      )}
    </section>
  );
}
