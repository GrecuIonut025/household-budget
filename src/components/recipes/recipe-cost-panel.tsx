"use client";

import clsx from "clsx";
import { AlertTriangle, Home, Info, PiggyBank, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { toggleIngredientAtHome } from "@/app/actions/recipes";
import { Badge, Card, CardTitle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { computeRecipeCost, type IngredientLine, type IngredientInput, type PantryStock } from "@/lib/recipes/cost";
import type { PricingMap } from "@/lib/recipes/pricing";
import { formatQuantity, SERVING_PRESETS } from "@/lib/recipes/scaling";
import type { Unit } from "@/lib/units";

export interface RecipeCostPanelProps {
  householdId: string;
  baseServings: number;
  ingredients: IngredientInput[];
  pricing: PricingMap;
  pantry: PantryStock[];
  currency: string;
  canWrite: boolean;
}

function unitKey(unit: Unit): MessageKey {
  return `recipes.unit.${unit}` as MessageKey;
}

export function RecipeCostPanel({ householdId, baseServings, ingredients, pricing, pantry, currency, canWrite }: RecipeCostPanelProps) {
  const { t, locale } = useI18n();
  const [servings, setServings] = useState(baseServings);

  const options = useMemo(() => {
    const set = new Set<number>([...SERVING_PRESETS, baseServings]);
    return [...set].sort((a, b) => a - b);
  }, [baseServings]);

  const cost = useMemo(
    () => computeRecipeCost({ baseServings, targetServings: servings, ingredients, pricing, pantry }),
    [baseServings, servings, ingredients, pricing, pantry],
  );

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const showToBuy = cost.toBuyMinor !== null && cost.toBuyMinor !== cost.totalMinor;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{t("recipes.servings")}</CardTitle>
        <div role="radiogroup" aria-label={t("recipes.servings")} className="grid auto-cols-fr grid-flow-col gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={servings === n}
              onClick={() => setServings(n)}
              className={clsx(
                "tabular min-h-11 rounded-lg px-3 text-sm font-semibold transition",
                servings === n ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              {formatQuantity(n, locale)}
              {n === baseServings && !(SERVING_PRESETS as readonly number[]).includes(n) ? <span className="ml-1 text-xs font-normal">·&nbsp;{t("recipes.original")}</span> : null}
            </button>
          ))}
        </div>
      </Card>

      <section aria-label={t("recipes.cost.title")} className="rounded-[var(--radius-lg)] border border-border bg-gradient-to-br from-brand-soft to-surface p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("recipes.cost.total")}</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight" data-testid="recipe-total">
              {cost.totalMinor === null ? t("recipes.cost.unknown") : `${cost.unknownCount > 0 ? "≥ " : ""}${money(cost.totalMinor)}`}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("recipes.cost.perServing")}</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight" data-testid="recipe-per-serving">
              {cost.perServingMinor === null ? t("recipes.cost.unknown") : `${cost.unknownCount > 0 ? "≥ " : ""}${money(cost.perServingMinor)}`}
            </p>
          </div>
        </div>

        {showToBuy ? (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Home size={16} className="text-muted" aria-hidden />
            <span className="text-muted">{t("recipes.cost.toBuy")}</span>
            <span className="tabular font-semibold">
              {cost.toBuyUnknownCount > 0 ? "≥ " : ""}
              {money(cost.toBuyMinor ?? 0)}
            </span>
          </p>
        ) : null}

        {cost.savingsMinor > 0 ? (
          <p className="mt-2 flex items-start gap-2 text-sm text-ok">
            <PiggyBank size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{t("recipes.cost.savings", { amount: money(cost.savingsMinor) })}</span>
          </p>
        ) : null}

        <div className="mt-3 space-y-2 text-sm">
          {cost.unknownCount > 0 ? (
            <p className="flex items-start gap-2 text-warn">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{t("recipes.cost.unknownCount", { count: cost.unknownCount })}</span>
            </p>
          ) : null}
          {cost.usesLastPurchase ? (
            <p className="flex items-start gap-2 text-muted">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>{t("recipes.cost.usesLastPurchase")}</span>
            </p>
          ) : null}
        </div>
      </section>

      <Card>
        <CardTitle>{t("recipes.ingredients")}</CardTitle>
        {cost.lines.length === 0 ? (
          <p className="text-sm text-muted">{t("recipes.noIngredients")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {cost.lines.map((line) => (
              <IngredientRow key={line.id} line={line} householdId={householdId} currency={currency} canWrite={canWrite} />
            ))}
          </ul>
        )}
      </Card>

      {cost.baskets.length > 0 || cost.partialBaskets.length > 0 ? (
        <Card>
          <CardTitle>{t("recipes.baskets.title")}</CardTitle>
          <p className="mb-3 text-xs text-muted">{t("recipes.baskets.hint")}</p>
          <ul className="space-y-2">
            {cost.baskets.map((b, index) => (
              <li key={b.retailerId} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Store size={16} className="shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{b.retailerName}</span>
                  {index === 0 ? <Badge tone="ok">{t("recipes.baskets.cheapest")}</Badge> : null}
                </span>
                <span className="tabular text-sm font-semibold">{money(b.totalMinor)}</span>
              </li>
            ))}
            {cost.partialBaskets.map((b) => (
              <li key={b.retailerId} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2.5">
                <span className="flex min-w-0 flex-col text-sm">
                  <span className="truncate font-medium">{b.retailerName}</span>
                  <span className="text-xs text-muted">{t("recipes.baskets.missing", { count: b.missingCount })}</span>
                </span>
                <span className="tabular text-sm text-muted">≥ {money(b.totalMinor)}</span>
              </li>
            ))}
          </ul>
          {cost.cheapestMixedMinor !== null && cost.baskets.length > 0 && cost.cheapestMixedMinor < cost.baskets[0].totalMinor ? (
            <p className="mt-3 text-xs text-muted">
              {t("recipes.baskets.mixed", { amount: money(cost.cheapestMixedMinor), saving: money(cost.baskets[0].totalMinor - cost.cheapestMixedMinor) })}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function IngredientRow({ line, householdId, currency, canWrite }: { line: IngredientLine; householdId: string; currency: string; canWrite: boolean }) {
  const { t, locale } = useI18n();
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const amount = line.quantity !== null && line.unit ? `${formatQuantity(line.quantity, locale)} ${t(unitKey(line.unit))}` : null;
  const hasDetails = line.options.length > 1 || line.substitutions.length > 0 || line.unknownReason !== null;
  const sourceNote =
    line.cost?.source.kind === "last_purchase"
      ? t("recipes.cost.lastPurchase", {
          retailer: line.cost.source.retailerName ?? "—",
          date: line.cost.source.asOf ? formatDate(line.cost.source.asOf, locale, { day: "numeric", month: "short", year: "numeric" }) : "—",
        })
      : null;

  return (
    <li className={clsx("py-3", !line.counted && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {amount ? <span className="tabular mr-1.5 font-semibold">{amount}</span> : null}
            {line.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {line.isOptional ? <Badge>{t("recipes.optional")}</Badge> : null}
            {line.coverage === "at_home" ? <Badge tone="ok">{t("recipes.coverage.atHome")}</Badge> : null}
            {line.coverage === "pantry" ? <Badge tone="ok">{t("recipes.coverage.pantry")}</Badge> : null}
            {line.coverage === "partial_pantry" ? <Badge tone="warn">{t("recipes.coverage.partialPantry", { percent: Math.round(line.coveredFraction * 100) })}</Badge> : null}
            {line.cost?.source.kind === "retailer" && line.cost.source.retailerName ? (
              <Badge tone="brand">
                {line.cost.source.retailerName}
                {line.cost.source.isPromo ? ` · ${t("recipes.promo")}` : ""}
              </Badge>
            ) : null}
            {line.cost?.source.kind === "last_purchase" ? <Badge tone="warn">{t("recipes.cost.lastPurchaseBadge")}</Badge> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {line.cost ? (
            <p className="tabular text-sm font-semibold">{money(line.cost.minor)}</p>
          ) : (
            <p className="text-sm font-medium text-warn">{t("recipes.cost.unknown")}</p>
          )}
          {line.savingsMinor > 0 ? <p className="tabular text-xs text-ok">{t("recipes.cost.saveHere", { amount: money(line.savingsMinor) })}</p> : null}
        </div>
      </div>

      {line.note ? <p className="mt-1 text-xs text-muted">{line.note}</p> : null}
      {sourceNote ? <p className="mt-1 text-xs text-muted">{sourceNote}</p> : null}

      {hasDetails ? (
        <details className="mt-2 rounded-[var(--radius-md)] bg-surface-2 px-3 py-2 text-sm">
          <summary className="min-h-6 cursor-pointer text-xs font-medium text-muted">{t("recipes.cost.details")}</summary>
          <div className="mt-2 space-y-3">
            {line.unknownReason ? (
              <p className="text-xs text-warn">
                {line.conversionError ? t(`recipes.conversion.${line.conversionError.code}` as MessageKey) : t(`recipes.unknown.${line.unknownReason}` as MessageKey)}
              </p>
            ) : null}
            {line.options.length > 1 ? (
              <ul className="space-y-1">
                {line.options.map((o) => (
                  <li key={o.retailerId} className="flex justify-between gap-3 text-xs">
                    <span>
                      {o.retailerName}
                      {o.isPromo ? ` · ${t("recipes.promo")}` : ""}
                    </span>
                    <span className="tabular font-medium">{money(o.minor)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {line.substitutions.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium">{t("recipes.substitutions")}</p>
                <ul className="space-y-1">
                  {line.substitutions.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3 text-xs">
                      <span>
                        {s.quantity !== null && s.unit ? `${formatQuantity(s.quantity, locale)} ${t(unitKey(s.unit))} ` : ""}
                        {s.name}
                      </span>
                      <span className="tabular text-right">
                        {s.cost ? money(s.cost.minor) : t("recipes.cost.unknown")}
                        {s.deltaMinor !== null && s.deltaMinor !== 0 ? (
                          <span className={clsx("ml-1.5", s.deltaMinor < 0 ? "text-ok" : "text-muted")}>
                            ({s.deltaMinor > 0 ? "+" : "−"}
                            {money(Math.abs(s.deltaMinor))})
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {canWrite ? (
        <form action={toggleIngredientAtHome} className="mt-2">
          <input type="hidden" name="id" value={line.id} />
          <input type="hidden" name="householdId" value={householdId} />
          <input type="hidden" name="atHome" value={String(!line.isAtHome)} />
          <button type="submit" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <Home size={14} aria-hidden />
            {line.isAtHome ? t("recipes.coverage.unmarkAtHome") : t("recipes.coverage.markAtHome")}
          </button>
        </form>
      ) : null}
    </li>
  );
}
