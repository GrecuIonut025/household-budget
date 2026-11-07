"use client";

import clsx from "clsx";
import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { EvolutionPoint, EvolutionRange } from "@/lib/dashboard-charts";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/money";

const RANGES: EvolutionRange[] = ["7d", "30d", "3m", "12m"];

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatAxis(minor: number, locale: string): string {
  const major = minor / 100;
  if (major >= 1000) {
    const k = major / 1000;
    const rounded = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
    return `${rounded}k`;
  }
  return new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US", {
    maximumFractionDigits: 0,
  }).format(major);
}

export function BudgetEvolutionChart({
  seriesByRange,
  currency,
}: {
  seriesByRange: Record<EvolutionRange, EvolutionPoint[]>;
  currency: string;
}) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<EvolutionRange>("30d");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const formatAmount = (minor: number) => formatMoney(minor, currency, locale);

  const model = useMemo(() => {
    const points = seriesByRange[range] ?? [];
    const hasActivity = points.some((p) => p.dailyExpenses > 0);
    if (points.length === 0 || !hasActivity) {
      return { empty: true as const, points: [] as EvolutionPoint[] };
    }

    const periodLimit = points[0]?.budgetLimit ?? null;
    const dailyBudget =
      periodLimit !== null && periodLimit > 0
        ? Math.round(periodLimit / Math.max(points.length, 1))
        : null;
    const peakDaily = Math.max(...points.map((p) => p.dailyExpenses));
    const maxY = niceMax(Math.max(peakDaily, dailyBudget ?? 0));

    // Highlight the peak spend day (ties → most recent).
    let peakIndex = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i]!.dailyExpenses >= points[peakIndex]!.dailyExpenses) peakIndex = i;
    }

    const tickCount = 5;
    const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
      Math.round(maxY - (maxY / tickCount) * i),
    );

    const labelIndexes =
      points.length <= 4
        ? points.map((_, i) => i)
        : [0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1];

    return {
      empty: false as const,
      points,
      maxY,
      dailyBudget,
      peakIndex,
      ticks,
      labelIndexes: [...new Set(labelIndexes)],
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

  const focusedIndex =
    activeIndex !== null && !model.empty
      ? activeIndex
      : !model.empty
        ? model.peakIndex
        : null;

  return (
    <section className="dashboard-card flex flex-col justify-between p-5 lg:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <TrendingUp size={16} aria-hidden />
          </div>
          <h2 className="text-base font-semibold text-fg">{t("dashboard.evolution")}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#262e4e] bg-[#191e33] px-1 py-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  setActiveIndex(null);
                }}
                className={clsx(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                  range === r
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "text-slate-300 hover:text-white",
                )}
              >
                {rangeLabel(r)}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-3 text-xs sm:flex">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="size-2.5 rounded-full bg-purple-500" />
              {t("dashboard.evolutionSpent")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <span className="inline-block h-0 w-3 border-t-2 border-dashed border-slate-500" />
              {t("dashboard.evolutionBudget")}
            </span>
          </div>
        </div>
      </div>

      {!model.empty ? (
        <div className="relative h-64 w-full select-none">
          {/* Grid + Y labels */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between text-[11px] text-slate-500">
            {model.ticks.map((tick, i) => {
              const isBudgetTick =
                model.dailyBudget !== null &&
                Math.abs(tick - model.dailyBudget) <= model.maxY / 20;
              return (
                <div
                  key={`${tick}-${i}`}
                  className={clsx(
                    "flex items-center justify-between pb-1",
                    i < model.ticks.length - 1 && !isBudgetTick
                      ? "border-b border-white/[0.04]"
                      : null,
                  )}
                >
                  <span className={isBudgetTick ? "text-slate-400" : undefined}>
                    {i === model.ticks.length - 1
                      ? `0 ${currency}`
                      : formatAxis(tick, locale)}
                  </span>
                  <div
                    className={clsx(
                      "mx-3 w-full",
                      isBudgetTick
                        ? "border-t-2 border-dashed border-slate-500/60"
                        : "border-t border-white/[0.04]",
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Bars */}
          <div
            className="absolute inset-0 ml-10 flex items-end justify-between px-2 pt-6 pb-6"
            role="img"
            aria-label={t("dashboard.evolution")}
          >
            {model.dailyBudget !== null ? (
              <div
                className="pointer-events-none absolute right-2 left-2 z-10 border-t-2 border-dashed border-slate-500/60"
                style={{ bottom: `${(model.dailyBudget / model.maxY) * 100}%` }}
                aria-hidden
              />
            ) : null}
            {model.points.map((point, index) => {
              const heightPct =
                model.maxY > 0
                  ? Math.max(
                      point.dailyExpenses > 0 ? 4 : 0,
                      (point.dailyExpenses / model.maxY) * 100,
                    )
                  : 0;
              const focused = focusedIndex === index;
              const tipOpen = activeIndex === index || (activeIndex === null && focused);

              return (
                <div
                  key={point.date}
                  className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  {tipOpen && point.dailyExpenses > 0 ? (
                    <div className="absolute -top-2 z-20 -translate-y-full whitespace-nowrap rounded-xl border border-purple-500/50 bg-[#0a0d17] px-2.5 py-1.5 text-center shadow-xl glow-purple transition-transform duration-300">
                      <div className="text-[10px] font-medium text-slate-400">
                        {formatDate(point.date, locale)}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs font-bold text-white">
                        <span className="inline-block size-2 rounded-full bg-purple-400" />
                        {formatAmount(point.dailyExpenses)}
                      </div>
                      <div className="mx-auto mt-0.5 -mb-1 size-2 rotate-45 border-r border-b border-purple-500/50 bg-[#0a0d17]" />
                    </div>
                  ) : null}

                  <button
                    type="button"
                    aria-label={`${formatDate(point.date, locale)}: ${formatAmount(point.dailyExpenses)}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                    className={clsx(
                      "rounded-t-md transition-all duration-300",
                      focused
                        ? "w-3 bg-gradient-to-t from-purple-600 via-purple-400 to-pink-300 shadow-lg shadow-purple-500/50 ring-2 ring-purple-400/50 hover:scale-105"
                        : "w-2.5 bg-gradient-to-t from-purple-800 to-indigo-500 opacity-85 hover:scale-105 hover:opacity-100",
                      model.points.length > 60 && !focused && "w-1.5",
                      model.points.length > 120 && !focused && "w-1",
                    )}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Bottom date ticks */}
          <div className="absolute right-0 bottom-0 left-10 flex justify-between px-4 text-[11px] font-medium text-slate-400">
            {model.labelIndexes.map((i) => (
              <span key={model.points[i]!.date}>
                {formatDate(model.points[i]!.date, locale)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative h-64 w-full">
          <div className="absolute inset-0 flex flex-col justify-between text-[11px] text-slate-500">
            {["5k", "4k", "3k", "2k", "1k", `0 ${currency}`].map((label, i) => (
              <div
                key={label}
                className={clsx(
                  "flex items-center justify-between pb-1",
                  i < 5 ? "border-b border-white/[0.04]" : null,
                )}
              >
                <span>{label}</span>
                <div className="mx-3 w-full border-t border-white/[0.04]" />
              </div>
            ))}
          </div>
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {t("dashboard.categoriesEmpty")}
          </p>
        </div>
      )}
    </section>
  );
}
