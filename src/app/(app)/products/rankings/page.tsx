import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ShoppingBasket, TrendingUp, PiggyBank, Users, Gem } from "lucide-react";
import { ProductsTabs } from "@/components/products/products-tabs";
import { RecurringListButton } from "@/components/products/recurring-list-button";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/data/context";
import { getProductPrices, getProducts, getPurchasesSince, getRetailers } from "@/lib/data/products";
import { canWrite } from "@/lib/data/types";
import { todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import {
  greatestPotentialSavings,
  highestPriceIncreases,
  mostExpensiveRecurring,
  mostPurchased,
  mostPurchasedPerMember,
  SAVINGS_WINDOW_DAYS,
} from "@/lib/products/rankings";

const HISTORY_DAYS = 365;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: `${t("products.title")} · ${t("products.tabRankings")}` };
}

export default async function RankingsPage() {
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const today = todayFor(household.timezone);

  const [products, purchases, prices, retailers, members] = await Promise.all([
    getProducts(household.id, { filter: "any" }),
    getPurchasesSince(household.id, today, HISTORY_DAYS),
    getProductPrices(household.id),
    getRetailers(),
    getMembers(household.id),
  ]);

  const nameOf = new Map(products.map((p) => [p.id, p.name]));
  const retailerName = new Map(retailers.map((r) => [r.id, r.name]));
  const memberName = new Map(members.map((m) => [m.user_id, m.display_name]));
  const money = (minor: number) => formatMoney(Math.round(minor), household.currency, locale);
  const pct = new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-GB", { style: "percent", maximumFractionDigits: 0 });

  const top = mostPurchased(products);
  const expensive = mostExpensiveRecurring(products);
  const increases = highestPriceIncreases(purchases);
  const savings = greatestPotentialSavings(products, prices, purchases, { today, currency: household.currency });
  const perMember = mostPurchasedPerMember(purchases);

  const link = (id: string) => (
    <Link href={`/products/${id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
      {nameOf.get(id) ?? "—"}
    </Link>
  );
  const row = "flex min-h-12 items-center gap-3 py-2";
  const empty = (title: string, body?: string) => <EmptyState title={title} body={body} />;
  const heading = (icon: React.ReactNode, label: string) => (
    <span className="flex items-center gap-2">
      <span className="text-brand-strong">{icon}</span>
      {label}
    </span>
  );

  return (
    <>
      <PageHeader title={t("products.title")} subtitle={t("products.rankingsSubtitle")} />
      <ProductsTabs active="rankings" t={t} />

      {canWrite(role) ? (
        <Card className="mb-4">
          <CardTitle>{t("products.recurringTitle")}</CardTitle>
          <RecurringListButton householdId={household.id} />
        </Card>
      ) : null}

      <div className="space-y-4">
        <Card>
          <CardTitle>{heading(<ShoppingBasket size={18} aria-hidden />, t("products.rankMostPurchased"))}</CardTitle>
          {top.length === 0 ? (
            empty(t("products.rankEmptyPurchases"), t("products.rankEmptyPurchasesBody"))
          ) : (
            <ol className="divide-y divide-border">
              {top.map((e, i) => (
                <li key={e.productId} className={row}>
                  <span className="tabular w-5 text-sm text-muted">{i + 1}</span>
                  {link(e.productId)}
                  <span className="shrink-0 text-right text-xs text-muted">
                    <span className="block text-sm font-semibold text-fg">{t("products.purchases", { count: e.purchaseCount })}</span>
                    {money(e.totalSpent)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardTitle>{heading(<Gem size={18} aria-hidden />, t("products.rankExpensive"))}</CardTitle>
          {expensive.length === 0 ? (
            empty(t("products.rankEmptyRecurring"), t("products.rankEmptyRecurringBody"))
          ) : (
            <ol className="divide-y divide-border">
              {expensive.map((e, i) => (
                <li key={e.productId} className={row}>
                  <span className="tabular w-5 text-sm text-muted">{i + 1}</span>
                  {link(e.productId)}
                  <span className="shrink-0 text-right text-xs text-muted">
                    <span className="tabular block text-sm font-semibold text-fg">{money(e.avgPrice)}</span>
                    {t("products.purchases", { count: e.purchaseCount })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardTitle>{heading(<TrendingUp size={18} aria-hidden />, t("products.rankIncreases"))}</CardTitle>
          {increases.length === 0 ? (
            empty(t("products.rankEmptyIncreases"), t("products.rankEmptyIncreasesBody"))
          ) : (
            <ol className="divide-y divide-border">
              {increases.map((e) => (
                <li key={e.productId} className={row}>
                  {link(e.productId)}
                  <span className="shrink-0 text-right text-xs text-muted">
                    <span className="tabular flex items-center justify-end gap-1 text-sm font-semibold text-danger">
                      <ArrowUpRight size={14} aria-hidden />
                      {pct.format(e.changePct)}
                    </span>
                    {money(e.baseline)} → {money(e.latest)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardTitle>{heading(<PiggyBank size={18} aria-hidden />, t("products.rankSavings"))}</CardTitle>
          {prices.length === 0 ? (
            empty(t("products.rankEmptyPrices"), t("products.rankEmptyPricesBody"))
          ) : savings.length === 0 ? (
            empty(t("products.rankEmptySavings"), t("products.rankEmptySavingsBody", { days: SAVINGS_WINDOW_DAYS }))
          ) : (
            <>
              <ol className="divide-y divide-border">
                {savings.map((e) => (
                  <li key={e.productId} className={row}>
                    {link(e.productId)}
                    <span className="shrink-0 text-right text-xs text-muted">
                      <span className="tabular block text-sm font-semibold text-ok">
                        {t("products.saveUpTo", { amount: money(e.total) })}
                      </span>
                      {money(e.paidPrice)} → {money(e.cheapestPrice)} · {retailerName.get(e.retailerId) ?? "—"}
                      {e.isPromo ? <>{" "}<Badge tone="ok">{t("products.promo")}</Badge></> : null}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">{t("products.rankSavingsNote", { days: SAVINGS_WINDOW_DAYS })}</p>
            </>
          )}
        </Card>

        <Card>
          <CardTitle>{heading(<Users size={18} aria-hidden />, t("products.rankPerMember"))}</CardTitle>
          {perMember.length === 0 ? (
            empty(t("products.rankEmptyPurchases"), t("products.rankEmptyMembersBody"))
          ) : (
            <ul className="space-y-4">
              {perMember.map((m) => (
                <li key={m.userId ?? "none"}>
                  <p className="mb-1 flex items-baseline justify-between gap-2 text-sm font-semibold">
                    <span>{m.userId ? (memberName.get(m.userId) ?? "—") : t("common.unattributed")}</span>
                    <span className="text-xs font-normal text-muted">
                      {t("products.purchases", { count: m.purchaseCount })} · {money(m.totalSpent)}
                    </span>
                  </p>
                  <ol className="divide-y divide-border rounded-[var(--radius-md)] bg-surface-2 px-3">
                    {m.top.map((p) => (
                      <li key={p.productId} className={row}>
                        {link(p.productId)}
                        <span className="shrink-0 text-xs text-muted">{t("products.purchases", { count: p.purchaseCount })}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="mt-4 text-center text-xs text-muted">{t("products.rankPeriodNote", { days: HISTORY_DAYS })}</p>
    </>
  );
}
