import type { Metadata } from "next";
import { Store } from "lucide-react";
import { GlovoBrasovBrowse } from "@/components/prices/glovo-brasov";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireAppContext } from "@/lib/data/context";
import {
  browseGlovoProducts,
  getGlovoBrowseContext,
  hasGlovoCatalog,
  listGlovoMarkets,
  listGlovoSubcategories,
} from "@/lib/data/glovo";
import type { GlovoRetailerKey } from "@/lib/glovo/types";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.priceComparison") };
}

type Search = { market?: string; cat?: string; sub?: string; q?: string; page?: string };

const GLOVO_MARKETS = new Set<GlovoRetailerKey>(["profi", "carrefour", "kaufland", "mega_image"]);

function parseGlovoMarket(value: string | undefined): GlovoRetailerKey | null {
  if (!value) return null;
  return GLOVO_MARKETS.has(value as GlovoRetailerKey) ? (value as GlovoRetailerKey) : null;
}

export default async function PriceComparisonPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  await requireAppContext();
  const { t, locale } = await getTranslator();

  const market = parseGlovoMarket(params.market);
  const parentSlug = params.cat?.trim() || null;
  const categorySlug = params.sub?.trim() || null;
  const query = params.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);

  const [markets, catalogReady] = await Promise.all([listGlovoMarkets(), hasGlovoCatalog()]);

  let parents: Awaited<ReturnType<typeof getGlovoBrowseContext>>["parents"] = [];
  let subcategories: Awaited<ReturnType<typeof listGlovoSubcategories>> = [];
  let browse: Awaited<ReturnType<typeof browseGlovoProducts>> | null = null;

  if (market && catalogReady) {
    const ctx = await getGlovoBrowseContext(market);
    parents = ctx.parents;
    if (parentSlug) {
      subcategories = await listGlovoSubcategories(market, parentSlug);
    }
    const showProductList =
      Boolean(query) ||
      Boolean(categorySlug) ||
      (Boolean(parentSlug) && subcategories.length === 0);
    if (showProductList) {
      browse = await browseGlovoProducts({
        retailer: market,
        parentSlug,
        categorySlug,
        query,
        page,
      });
    }
  }

  const labels = {
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
  };

  return (
    <>
      <PageHeader title={t("prices.title")} subtitle={t("prices.subtitle")} />

      {!catalogReady ? (
        <EmptyState
          icon={<Store size={28} />}
          title={t("prices.glovo.emptyTitle")}
          body={t("prices.glovo.emptyBody")}
        />
      ) : (
        <GlovoBrasovBrowse
          markets={markets}
          selectedMarket={market}
          parents={parents}
          subcategories={subcategories}
          browse={browse}
          parentSlug={parentSlug}
          categorySlug={categorySlug}
          query={query}
          locale={locale}
          labels={labels}
        />
      )}
    </>
  );
}
