import type { StrategyResult } from "@/lib/shopping/types";
import type { MessageKey, Translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { Badge, Card, CardTitle } from "@/components/ui";

export function StrategyCards({
  strategies,
  currency,
  locale,
  t,
}: {
  strategies: StrategyResult[];
  currency: string;
  locale: string;
  t: Translate;
}) {
  if (strategies.length === 0) return null;
  const money = (minor: number | null) => (minor === null ? "—" : formatMoney(minor, currency, locale));

  return (
    <Card>
      <CardTitle>{t("shopping.strategies")}</CardTitle>
      <ul className="space-y-3">
        {strategies.map((s) => (
          <li key={s.kind} className="rounded-xl border border-border bg-surface-2/50 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t(`shopping.strategy.${s.kind}` as MessageKey)}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t("shopping.strategy.shops", { count: s.retailerCount })}
                  {s.missingCount > 0 ? ` · ${t("shopping.strategy.missing", { count: s.missingCount })}` : ""}
                </p>
              </div>
              <p className="tabular shrink-0 text-sm font-semibold">{money(s.totalMinor)}</p>
            </div>
            {s.savingsMinor > 0 ? (
              <span className="mt-2 inline-flex">
                <Badge tone="ok">{t("shopping.strategy.savings", { amount: money(s.savingsMinor) })}</Badge>
              </span>
            ) : null}
            {s.retailers.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {s.retailers.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>{r.name}</span>
                    <span className="tabular">{formatMoney(r.totalMinor, currency, locale)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
