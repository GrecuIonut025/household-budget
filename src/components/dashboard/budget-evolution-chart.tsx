"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import type { EvolutionPoint, EvolutionRange } from "@/lib/dashboard-charts";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/money";

const RANGES: EvolutionRange[] = ["7d", "30d", "3m", "12m"];

function shortDate(iso: string, locale: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  try {
    return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
      day: "numeric",
      month: "short",
    }).format(new Date(Date.UTC(2000, m - 1, d)));
  } catch {
    return `${d}/${m}`;
  }
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
  const [hover, setHover] = useState<number | null>(null);
  const formatAmount = (minor: number) => formatMoney(minor, currency, locale);

  const geometry = useMemo(() => {
    const points = seriesByRange[range] ?? [];
    if (points.length === 0) return null;
    const width = 640;
    const height = 220;
    const padL = 8;
    const padR = 8;
    const padT = 24;
    const padB = 28;
    const maxY = Math.max(
      1,
      ...points.map((p) => p.dailyExpenses),
      ...points.map((p) => p.budgetLimit ?? 0),
    );
    const innerW = width - padL - padR;
    const gap = points.length > 40 ? 1 : points.length > 20 ? 2 : 4;
    const barW = Math.max(2, (innerW - gap * (points.length - 1)) / points.length);
    const yAt = (v: number) => padT + (1 - v / maxY) * (height - padT - padB);
    const budget = points[0]?.budgetLimit;
    const budgetY = budget === null || budget === undefined ? null : yAt(budget);
    const labelEvery = Math.max(1, Math.ceil(points.length / 6));

    return {
      width,
      height,
      padB,
      points,
      barW,
      gap,
      padL,
      yAt,
      budgetY,
      labelEvery,
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

  const activeIndex =
    hover ??
    (geometry
      ? (() => {
          let best = geometry.points.length - 1;
          for (let i = geometry.points.length - 1; i >= 0; i--) {
            if (geometry.points[i]!.dailyExpenses > 0) {
              best = i;
              break;
            }
          }
          return best;
        })()
      : null);

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{t("dashboard.evolution")}</h2>
        <div className="inline-flex rounded-full bg-surface-2 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                range === r ? "brand-gradient text-brand-fg" : "text-muted hover:text-fg",
              )}
            >
              {rangeLabel(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand" />
          {t("dashboard.evolutionSpent")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed border-fg/70" />
          {t("dashboard.evolutionBudget")}
        </span>
      </div>

      {geometry ? (
        <div className="relative">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-auto w-full"
            role="img"
            aria-label={t("dashboard.evolution")}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            {geometry.budgetY !== null ? (
              <line
                x1={geometry.padL}
                x2={geometry.width - 8}
                y1={geometry.budgetY}
                y2={geometry.budgetY}
                stroke="currentColor"
                className="text-fg/55"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
            ) : null}
            {geometry.points.map((p, i) => {
              const x = geometry.padL + i * (geometry.barW + geometry.gap);
              const h = Math.max(0, geometry.yAt(0) - geometry.yAt(p.dailyExpenses));
              const y = geometry.yAt(p.dailyExpenses);
              const active = i === activeIndex;
              return (
                <g key={p.date}>
                  <rect
                    x={x}
                    y={y}
                    width={geometry.barW}
                    height={h}
                    rx={Math.min(4, geometry.barW / 2)}
                    fill="url(#barFill)"
                    opacity={active ? 1 : 0.55}
                    onMouseEnter={() => setHover(i)}
                  />
                  {i % geometry.labelEvery === 0 || i === geometry.points.length - 1 ? (
                    <text
                      x={x + geometry.barW / 2}
                      y={geometry.height - 8}
                      textAnchor="middle"
                      className="fill-muted"
                      fontSize="10"
                    >
                      {shortDate(p.date, locale)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {activeIndex !== null && geometry.points[activeIndex] ? (
            <div
              className="pointer-events-none absolute rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs shadow-sm"
              style={{
                left: `${Math.min(
                  78,
                  Math.max(
                    4,
                    ((geometry.padL +
                      activeIndex * (geometry.barW + geometry.gap) +
                      geometry.barW / 2) /
                      geometry.width) *
                      100 -
                      8,
                  ),
                )}%`,
                top: "4%",
              }}
            >
              <p className="font-semibold tabular text-fg">
                {shortDate(geometry.points[activeIndex]!.date, locale)} ·{" "}
                {formatAmount(geometry.points[activeIndex]!.dailyExpenses)}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted">{t("dashboard.categoriesEmpty")}</p>
      )}
    </section>
  );
}
