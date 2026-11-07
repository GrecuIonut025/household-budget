import type { Metadata } from "next";
import Link from "next/link";
import { Scale } from "lucide-react";
import { verifyPriceMatch } from "@/app/actions/prices";
import { AdapterRefreshButtons } from "@/components/prices/refresh-forms";
import { AlertCreateForm, AlertsList } from "@/components/prices/alert-form";
import { ManualPriceButton } from "@/components/prices/manual-price-form";
import { PriceHistoryChart } from "@/components/prices/price-history-chart";
import { Badge, Card, CardTitle, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { requireAppContext } from "@/lib/data/context";
import { getProducts, getRetailers } from "@/lib/data/products";
import { getRetailersWithMonitorIds, listPriceAlerts, listPriceDetails, listPriceHistory, toComparisonQuotes } from "@/lib/data/prices";
import { canWrite } from "@/lib/data/types";
import { formatDate, todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";
import { buildComparison } from "@/lib/prices/compare";
import { AUTO_LINK_THRESHOLD } from "@/lib/prices/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.priceComparison") };
}

type Search = { fav?: string; product?: string };

export default async function PriceComparisonPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);
  const today = todayFor(household.timezone);
  const favoritesOnly = params.fav === "1";

  const [products, retailers, priceRows, alerts] = await Promise.all([
    getProducts(household.id, { filter: favoritesOnly ? "favorites" : "all" }),
    getRetailersWithMonitorIds(),
    listPriceDetails(household.id),
    listPriceAlerts(household.id, ctx.user.id),
  ]);
  const simpleRetailers = await getRetailers();

  const quotes = toComparisonQuotes(priceRows, retailers);
  const pricedProductIds = new Set(quotes.map((q) => q.productId));
  const visibleProducts = products.filter((p) => pricedProductIds.has(p.id) || favoritesOnly);
  const comparison = buildComparison(
    visibleProducts.map((p) => ({ id: p.id, name: p.name, brand: p.brand })),
    quotes,
  ).filter((row) => row.quotes.length > 0);

  const focusId = params.product && comparison.some((c) => c.productId === params.product) ? params.product : comparison[0]?.productId;
  const focusHistory = focusId ? await listPriceHistory(household.id, focusId) : [];
  const focusProduct = products.find((p) => p.id === focusId) ?? null;
  const detailByKey = new Map(priceRows.map((r) => [`${r.product_id}:${r.retailer_id}`, r]));

  const money = (n: number, currency = household.currency) => formatMoney(toMinor(n), currency, locale);

  return (
    <>
      <PageHeader
        title={t("prices.title")}
        subtitle={t("prices.subtitle")}
        action={
          writer ? (
            <ManualPriceButton
              householdId={household.id}
              products={products.map((p) => ({ id: p.id, name: p.name }))}
              retailers={simpleRetailers}
              currency={household.currency}
              today={today}
            />
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/price-comparison"
          className={buttonClass(favoritesOnly ? "secondary" : "primary")}
        >
          {t("prices.filterAll")}
        </Link>
        <Link
          href="/price-comparison?fav=1"
          className={buttonClass(favoritesOnly ? "primary" : "secondary")}
        >
          {t("prices.filterFavorites")}
        </Link>
      </div>

      {writer ? (
        <Card className="mb-4">
          <CardTitle>{t("prices.refreshMonitor")}</CardTitle>
          <AdapterRefreshButtons householdId={household.id} />
        </Card>
      ) : null}

      {comparison.length === 0 ? (
        <EmptyState icon={<Scale size={28} />} title={t("prices.emptyTitle")} body={t("prices.emptyBody")} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t("prices.compareHint")}</p>
          {comparison.map((row) => (
            <Card key={row.productId}>
              <CardTitle
                action={
                  <Link href={`/products/${row.productId}`} className="text-xs font-medium text-brand hover:underline">
                    {t("common.edit")}
                  </Link>
                }
              >
                <Link href={`/price-comparison?product=${row.productId}${favoritesOnly ? "&fav=1" : ""}`} className="hover:underline">
                  {row.productName}
                </Link>
                {row.brand ? <span className="ml-2 text-xs font-normal text-muted">{row.brand}</span> : null}
              </CardTitle>
              <ul className="-mx-1 divide-y divide-border">
                {row.quotes.map((q) => {
                  const detail = detailByKey.get(`${q.productId}:${q.retailerId}`);
                  const uncertain =
                    q.source === "adapter" && !q.isVerified && (q.matchConfidence === null || q.matchConfidence < AUTO_LINK_THRESHOLD);
                  return (
                    <li key={`${q.retailerId}-${q.observedAt}`} className="flex flex-wrap items-center gap-2 px-1 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{q.retailerName}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {t(`prices.source.${q.source}`)}
                          {" · "}
                          {t("prices.observed", {
                            date: formatDate(q.observedAt.slice(0, 10), locale, { day: "numeric", month: "short" }),
                          })}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {q.isPromo ? <Badge tone="ok">{t("prices.promo")}</Badge> : null}
                          {q.loyaltyRequired ? <Badge tone="warn">{t("prices.loyalty")}</Badge> : null}
                          {uncertain ? <Badge tone="warn">{t("prices.needsReview")}</Badge> : null}
                          {row.cheapest?.retailerId === q.retailerId ? <Badge tone="brand">{t("prices.cheapest")}</Badge> : null}
                        </span>
                      </span>
                      <span className="tabular text-base font-semibold">{money(q.price, q.currency)}</span>
                      {writer && uncertain && detail ? (
                        <form action={verifyPriceMatch}>
                          <input type="hidden" name="householdId" value={household.id} />
                          <input type="hidden" name="id" value={detail.id} />
                          <button type="submit" className={buttonClass("secondary")}>
                            {t("prices.verifyMatch")}
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {row.spread != null ? (
                <p className="mt-2 text-xs text-muted">
                  {t("prices.spread")}: {money(row.spread)}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {focusProduct ? (
        <Card className="mt-4">
          <CardTitle>
            {t("prices.historyTitle")} — {focusProduct.name}
          </CardTitle>
          <PriceHistoryChart
            points={focusHistory}
            retailers={simpleRetailers}
            currency={household.currency}
            locale={locale}
            empty={t("prices.historyEmpty")}
          />
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardTitle>{t("prices.alertsTitle")}</CardTitle>
        {writer ? (
          <div className="mb-4">
            <AlertCreateForm
              householdId={household.id}
              products={products.map((p) => ({ id: p.id, name: p.name }))}
              retailers={simpleRetailers}
            />
          </div>
        ) : null}
        <AlertsList
          householdId={household.id}
          alerts={alerts}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          retailers={simpleRetailers}
          currency={household.currency}
          locale={locale}
        />
      </Card>
    </>
  );
}
