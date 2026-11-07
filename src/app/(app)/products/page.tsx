import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Package, Search } from "lucide-react";
import { FavoriteButton } from "@/components/products/product-flag-button";
import { ProductThumb } from "@/components/products/product-thumb";
import { ProductsTabs } from "@/components/products/products-tabs";
import { ProductsToolbar } from "@/components/products/products-toolbar";
import { Badge, Card, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { requireAppContext } from "@/lib/data/context";
import { getProducts, getRetailers, signProductImages, type ProductFilter } from "@/lib/data/products";
import { canWrite } from "@/lib/data/types";
import { formatMoney, toMinor } from "@/lib/money";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("products.title") };
}

const FILTERS = ["all", "favorites", "frequent", "archived"] as const satisfies readonly ProductFilter[];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const params = await searchParams;
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);
  const q = (params.q ?? "").slice(0, 100);
  const filter = FILTERS.find((f) => f === params.filter) ?? "all";

  const [products, retailers] = await Promise.all([getProducts(household.id, { q, filter }), getRetailers()]);
  const images = await signProductImages(products.map((p) => p.image_path));
  const retailerName = new Map(retailers.map((r) => [r.id, r.name]));
  const filterHref = (f: (typeof FILTERS)[number]) => {
    const query = new URLSearchParams({ ...(q && { q }), ...(f !== "all" && { filter: f }) }).toString();
    return query ? `/products?${query}` : "/products";
  };
  const hasQuery = q !== "" || filter !== "all";

  return (
    <>
      <PageHeader
        title={t("products.title")}
        subtitle={t("products.subtitle")}
        action={<ProductsToolbar householdId={household.id} retailers={retailers} canWrite={writer} />}
      />
      <ProductsTabs active="catalogue" t={t} />

      <form action="/products" method="get" role="search" className="mb-3">
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <div className="relative">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("products.searchPlaceholder")}
            aria-label={t("products.searchPlaceholder")}
            className={clsx(inputClass, "pl-10")}
          />
        </div>
      </form>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t("products.filters")}>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={filterHref(f)}
            role="tab"
            aria-selected={filter === f}
            className={clsx(
              "inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium",
              filter === f ? "border-brand bg-brand-soft text-brand-strong" : "border-border bg-surface text-muted",
            )}
          >
            {t(`products.filter.${f}`)}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={28} aria-hidden />}
            title={hasQuery ? t("products.emptyFiltered") : t("products.emptyTitle")}
            body={hasQuery ? undefined : t("products.emptyBody")}
          />
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {products.map((p) => {
            const size = p.package_size && p.package_unit ? `${p.package_size} ${t(`products.unit.${p.package_unit}`)}` : null;
            const subtitle = [p.brand, size].filter(Boolean).join(" · ");
            return (
              <li key={p.id} className="flex items-center gap-1 pr-1">
                <Link href={`/products/${p.id}`} className="flex min-h-[4.5rem] min-w-0 flex-1 items-center gap-3 px-3 py-2 hover:bg-surface-2">
                  <ProductThumb url={p.image_path ? images.get(p.image_path) : null} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    {subtitle ? <span className="block truncate text-xs text-muted">{subtitle}</span> : null}
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {p.is_frequent ? <Badge tone="brand">{t("products.frequent")}</Badge> : null}
                      {p.preferred_retailer_id && retailerName.get(p.preferred_retailer_id) ? (
                        <Badge>{retailerName.get(p.preferred_retailer_id)}</Badge>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {p.last_price !== null ? (
                      <>
                        <span className="tabular block text-sm font-semibold">{formatMoney(toMinor(p.last_price), household.currency, locale)}</span>
                        <span className="block text-xs text-muted">{t("products.purchases", { count: p.purchase_count })}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">{t("products.noPurchases")}</span>
                    )}
                  </span>
                </Link>
                {writer ? <FavoriteButton productId={p.id} active={p.is_favorite} label={t(p.is_favorite ? "products.unfavorite" : "products.favorite")} /> : null}
              </li>
            );
          })}
        </ul>
      )}
      {!writer ? <p className="mt-4 text-center text-xs text-muted">{t("common.viewOnly")}</p> : null}
    </>
  );
}
