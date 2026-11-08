import Link from "next/link";
import { ChevronLeft, ChevronRight, FolderOpen, Search, Store } from "lucide-react";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type {
  GlovoBrowsePage,
  GlovoCategoryNode,
  GlovoMarket,
  GlovoRetailerKey,
} from "@/lib/glovo/types";
import { formatMoney, toMinor } from "@/lib/money";

const RETAILER_ORDER: GlovoRetailerKey[] = ["profi", "carrefour", "kaufland", "mega_image"];

type Labels = {
  title: string;
  subtitle: string;
  pickMarket: string;
  categories: string;
  subcategories: string;
  products: string;
  searchPlaceholder: string;
  search: string;
  allMarkets: string;
  emptyTitle: string;
  emptyBody: string;
  outOfStock: string;
  sourceNote: string;
  back: string;
  pageOf: string;
  prev: string;
  next: string;
  items: string;
  noProductsInCategory: string;
};

function href(parts: {
  market?: GlovoRetailerKey | null;
  cat?: string | null;
  sub?: string | null;
  q?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (parts.market) params.set("market", parts.market);
  if (parts.cat) params.set("cat", parts.cat);
  if (parts.sub) params.set("sub", parts.sub);
  if (parts.q?.trim()) params.set("q", parts.q.trim());
  if (parts.page && parts.page > 1) params.set("page", String(parts.page));
  const qs = params.toString();
  return qs ? `/price-comparison?${qs}` : "/price-comparison";
}

export function GlovoBrasovBrowse({
  markets,
  selectedMarket,
  parents,
  subcategories,
  browse,
  parentSlug,
  categorySlug,
  query,
  locale,
  labels,
}: {
  markets: GlovoMarket[];
  selectedMarket: GlovoRetailerKey | null;
  parents: GlovoCategoryNode[];
  subcategories: GlovoCategoryNode[];
  browse: GlovoBrowsePage | null;
  parentSlug: string | null;
  categorySlug: string | null;
  query: string;
  locale: string;
  labels: Labels;
}) {
  const ordered = RETAILER_ORDER.map((key) => markets.find((m) => m.retailer_key === key)).filter(
    (m): m is GlovoMarket => Boolean(m),
  );
  const activeMarket = selectedMarket
    ? ordered.find((m) => m.retailer_key === selectedMarket) ?? null
    : null;

  const showCategories = Boolean(selectedMarket) && !query && !parentSlug && !categorySlug;
  const showSubcategories =
    Boolean(selectedMarket) && Boolean(parentSlug) && !categorySlug && !query && subcategories.length > 0;
  const showProducts =
    Boolean(selectedMarket) &&
    (Boolean(query) ||
      Boolean(categorySlug) ||
      (Boolean(parentSlug) && subcategories.length === 0));

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-gradient-to-br from-[color:var(--card-purple)] via-[color:var(--surface)] to-[color:var(--card-blue)] p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
          Glovo · Brașov
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">{labels.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{labels.subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {ordered.map((market) => {
            const active = selectedMarket === market.retailer_key;
            return (
              <Link
                key={market.id}
                href={href({ market: active ? null : market.retailer_key })}
                className={buttonClass(active ? "primary" : "secondary")}
              >
                <span
                  className="mr-1.5 inline-flex size-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{ backgroundColor: market.brand_color ?? "var(--brand)" }}
                  aria-hidden
                >
                  {market.logo_emoji ?? market.name.slice(0, 1)}
                </span>
                {market.name}
              </Link>
            );
          })}
        </div>

        {selectedMarket ? (
          <form action="/price-comparison" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="market" value={selectedMarket} />
            {parentSlug ? <input type="hidden" name="cat" value={parentSlug} /> : null}
            {categorySlug ? <input type="hidden" name="sub" value={categorySlug} /> : null}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{labels.search}</span>
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={labels.searchPlaceholder}
                className="w-full rounded-[var(--radius-md)] border border-border bg-[color:var(--input-bg)] py-2.5 pr-3 pl-9 text-sm text-fg outline-none ring-brand/30 focus:ring-2"
              />
            </label>
            <button type="submit" className={buttonClass("primary")}>
              {labels.search}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm font-medium text-fg">{labels.pickMarket}</p>
        )}

        <p className="mt-3 text-xs text-muted">{labels.sourceNote}</p>
      </div>

      {selectedMarket ? (
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/price-comparison" className="text-brand hover:underline">
            {labels.allMarkets}
          </Link>
          {activeMarket ? (
            <>
              <span className="text-muted">/</span>
              <Link
                href={href({ market: selectedMarket })}
                className={!parentSlug && !query ? "font-semibold text-fg" : "text-brand hover:underline"}
              >
                {activeMarket.name}
              </Link>
            </>
          ) : null}
          {parentSlug ? (
            <>
              <span className="text-muted">/</span>
              <Link
                href={href({ market: selectedMarket, cat: parentSlug })}
                className={!categorySlug && !query ? "font-semibold text-fg" : "text-brand hover:underline"}
              >
                {parents.find((p) => p.slug === parentSlug)?.title || parentSlug}
              </Link>
            </>
          ) : null}
          {categorySlug ? (
            <>
              <span className="text-muted">/</span>
              <span className="font-semibold text-fg">
                {subcategories.find((c) => c.slug === categorySlug)?.title || categorySlug}
              </span>
            </>
          ) : null}
        </nav>
      ) : null}

      {!selectedMarket ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {ordered.map((market) => (
            <Link key={market.id} href={href({ market: market.retailer_key })} className="block">
              <Card className="transition hover:border-brand/40">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex size-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
                    style={{ backgroundColor: market.brand_color ?? "var(--brand)" }}
                  >
                    {market.logo_emoji ?? market.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-semibold text-fg">{market.name}</p>
                    <p className="text-xs text-muted">Brașov · Glovo</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}

      {showCategories ? (
        <CategoryGrid
          title={labels.categories}
          nodes={parents}
          hrefFor={(node) => href({ market: selectedMarket, cat: node.slug })}
          empty={labels.noProductsInCategory}
        />
      ) : null}

      {showSubcategories ? (
        <CategoryGrid
          title={labels.subcategories}
          nodes={subcategories}
          hrefFor={(node) =>
            href({ market: selectedMarket, cat: parentSlug, sub: node.slug })
          }
          empty={labels.noProductsInCategory}
          backHref={href({ market: selectedMarket })}
          backLabel={labels.back}
        />
      ) : null}

      {showProducts && browse ? (
        <ProductGrid
          title={labels.products}
          browse={browse}
          locale={locale}
          labels={labels}
          buildPageHref={(page) =>
            href({
              market: selectedMarket,
              cat: parentSlug,
              sub: categorySlug,
              q: query,
              page,
            })
          }
        />
      ) : null}

      {selectedMarket && !showCategories && !showSubcategories && !showProducts ? (
        <EmptyState
          icon={<Store size={28} />}
          title={labels.emptyTitle}
          body={labels.emptyBody}
        />
      ) : null}
    </section>
  );
}

function CategoryGrid({
  title,
  nodes,
  hrefFor,
  empty,
  backHref,
  backLabel,
}: {
  title: string;
  nodes: GlovoCategoryNode[];
  hrefFor: (node: GlovoCategoryNode) => string;
  empty: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {backHref && backLabel ? (
          <Link href={backHref} className={`${buttonClass("ghost")} inline-flex items-center gap-1`}>
            <ChevronLeft size={16} />
            {backLabel}
          </Link>
        ) : null}
      </div>
      {nodes.length === 0 ? (
        <EmptyState icon={<FolderOpen size={28} />} title={empty} body="" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node) => (
            <Link key={node.slug} href={hrefFor(node)} className="block">
              <Card className="h-full transition hover:border-brand/40">
                <p className="font-medium text-fg">{node.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {node.child_count > 0
                    ? `${node.child_count} · ${node.product_count}`
                    : `${node.product_count}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductGrid({
  title,
  browse,
  locale,
  labels,
  buildPageHref,
}: {
  title: string;
  browse: GlovoBrowsePage;
  locale: string;
  labels: Labels;
  buildPageHref: (page: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <Badge tone="brand">
          {labels.items.replace("{count}", String(browse.total))}
        </Badge>
      </div>
      {browse.items.length === 0 ? (
        <EmptyState icon={<Store size={28} />} title={labels.noProductsInCategory} body="" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {browse.items.map((product) => (
            <Card key={product.id} className="!p-3">
              <div className="flex gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Store size={20} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-fg">{product.name}</p>
                  {product.category ? (
                    <p className="mt-0.5 text-xs text-muted">{product.category}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="tabular text-base font-bold text-fg">
                      {product.price_display ??
                        formatMoney(
                          toMinor(product.price ?? 0),
                          product.currency || "RON",
                          locale,
                        )}
                    </span>
                    {product.out_of_stock ? (
                      <Badge tone="warn">{labels.outOfStock}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {browse.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="text-xs text-muted">
            {labels.pageOf
              .replace("{page}", String(browse.page))
              .replace("{pages}", String(browse.totalPages))}
          </p>
          <div className="flex gap-2">
            {browse.page > 1 ? (
              <Link
                href={buildPageHref(browse.page - 1)}
                className={`${buttonClass("secondary")} inline-flex items-center gap-1`}
              >
                <ChevronLeft size={16} />
                {labels.prev}
              </Link>
            ) : null}
            {browse.page < browse.totalPages ? (
              <Link
                href={buildPageHref(browse.page + 1)}
                className={`${buttonClass("secondary")} inline-flex items-center gap-1`}
              >
                {labels.next}
                <ChevronRight size={16} />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
