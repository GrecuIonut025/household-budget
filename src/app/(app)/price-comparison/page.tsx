import type { Metadata } from "next";
import { GlovoBrasovBrowse } from "@/components/prices/glovo-brasov";
import { PageHeader } from "@/components/ui";
import { requireAppContext } from "@/lib/data/context";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.priceComparison") };
}

export default async function PriceComparisonPage() {
  await requireAppContext();
  const { t, locale } = await getTranslator();

  return (
    <>
      <PageHeader title={t("prices.title")} subtitle={t("prices.subtitle")} />
      <GlovoBrasovBrowse
        locale={locale}
        labels={{
          title: t("prices.glovo.title"),
          subtitle: t("prices.glovo.subtitle"),
          pickMarket: t("prices.glovo.pickMarket"),
          categories: t("prices.glovo.categories"),
          subcategories: t("prices.glovo.subcategories"),
          products: t("prices.glovo.products"),
          searchPlaceholder: t("prices.glovo.searchPlaceholder"),
          search: t("prices.glovo.search"),
          allMarkets: t("prices.glovo.allMarkets"),
          emptyTitle: t("prices.glovo.emptyTitle"),
          emptyBody: t("prices.glovo.emptyBody"),
          outOfStock: t("prices.glovo.outOfStock"),
          sourceNote: t("prices.glovo.sourceNote"),
          back: t("prices.glovo.back"),
          pageOf: t("prices.glovo.pageOf"),
          prev: t("prices.glovo.prev"),
          next: t("prices.glovo.next"),
          items: t("prices.glovo.results"),
          noProductsInCategory: t("prices.glovo.noProductsInCategory"),
        }}
      />
    </>
  );
}
