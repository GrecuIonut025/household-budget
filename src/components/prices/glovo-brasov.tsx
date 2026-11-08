"use client";

import { ChevronLeft, ChevronRight, FolderOpen, Plus, Search, Store } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { GlovoOrderBar, useGlovoCart } from "@/components/prices/glovo-order-bar";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import {
  browseLocalProducts,
  listParentCategories,
  listSubcategories,
  type GlovoRawCategory,
} from "@/lib/glovo/browse";
import type {
  GlovoBrowsePage,
  GlovoCategoryNode,
  GlovoMarket,
  GlovoProduct,
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
  addToCart: string;
  prepareOrder: string;
  itemsCount: string;
  openInGlovo: string;
  clearCart: string;
  copyList: string;
  copied: string;
  handoffNote: string;
  emptyCart: string;
};

type CatalogPayload = {
  markets: GlovoMarket[];
  products: GlovoProduct[];
  categories: GlovoRawCategory[];
  empty: boolean;
};

let catalogPromise: Promise<CatalogPayload> | null = null;

function loadCatalog(): Promise<CatalogPayload> {
  if (!catalogPromise) {
    catalogPromise = fetch("/api/glovo/catalog", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error("catalog_failed");
        return (await res.json()) as CatalogPayload;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

/** Warm the catalog as soon as Comparare is likely to be opened. */
export function prefetchGlovoCatalog(): void {
  void loadCatalog().catch(() => {});
}

function syncUrl(state: {
  market: GlovoRetailerKey | null;
  cat: string | null;
  sub: string | null;
  q: string;
  page: number;
}) {
  const params = new URLSearchParams();
  if (state.market) params.set("market", state.market);
  if (state.cat) params.set("cat", state.cat);
  if (state.sub) params.set("sub", state.sub);
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.page > 1) params.set("page", String(state.page));
  const qs = params.toString();
  const next = qs ? `/price-comparison?${qs}` : "/price-comparison";
  if (typeof window !== "undefined" && window.location.pathname + window.location.search !== next) {
    window.history.replaceState(null, "", next);
  }
}

function readInitial(): {
  market: GlovoRetailerKey | null;
  cat: string | null;
  sub: string | null;
  q: string;
  page: number;
} {
  if (typeof window === "undefined") {
    return { market: null, cat: null, sub: null, q: "", page: 1 };
  }
  const params = new URLSearchParams(window.location.search);
  const market = params.get("market");
  return {
    market: RETAILER_ORDER.includes(market as GlovoRetailerKey)
      ? (market as GlovoRetailerKey)
      : null,
    cat: params.get("cat"),
    sub: params.get("sub"),
    q: params.get("q") ?? "",
    page: Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1),
  };
}

export function GlovoBrasovBrowse({ locale, labels }: { locale: string; labels: Labels }) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [market, setMarket] = useState<GlovoRetailerKey | null>(null);
  const [parentSlug, setParentSlug] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();
  const cart = useGlovoCart();

  useEffect(() => {
    const initial = readInitial();
    setMarket(initial.market);
    setParentSlug(initial.cat);
    setCategorySlug(initial.sub);
    setQuery(initial.q);
    setDraftQuery(initial.q);
    setPage(initial.page);

    let cancelled = false;
    loadCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    syncUrl({ market, cat: parentSlug, sub: categorySlug, q: query, page });
  }, [market, parentSlug, categorySlug, query, page]);

  const markets = catalog?.markets ?? [];
  const ordered = RETAILER_ORDER.map((key) => markets.find((m) => m.retailer_key === key)).filter(
    (m): m is GlovoMarket => Boolean(m),
  );
  const products = catalog?.products ?? [];
  const categories = catalog?.categories ?? [];

  const parents = useMemo(
    () => (market ? listParentCategories(market, products, categories) : []),
    [market, products, categories],
  );
  const subcategories = useMemo(
    () =>
      market && parentSlug
        ? listSubcategories(market, parentSlug, products, categories)
        : [],
    [market, parentSlug, products, categories],
  );

  const showCategories = Boolean(market) && !query && !parentSlug && !categorySlug;
  const showSubcategories =
    Boolean(market) && Boolean(parentSlug) && !categorySlug && !query && subcategories.length > 0;
  const showProducts =
    Boolean(market) &&
    (Boolean(query) ||
      Boolean(categorySlug) ||
      (Boolean(parentSlug) && subcategories.length === 0));

  const browse: GlovoBrowsePage | null = useMemo(() => {
    if (!market || !showProducts) return null;
    return browseLocalProducts(products, {
      retailer: market,
      parentSlug,
      categorySlug,
      query,
      page,
    });
  }, [market, showProducts, products, parentSlug, categorySlug, query, page]);

  const selectMarket = (next: GlovoRetailerKey | null) => {
    startTransition(() => {
      setMarket(next);
      setParentSlug(null);
      setCategorySlug(null);
      setQuery("");
      setDraftQuery("");
      setPage(1);
    });
  };

  const selectParent = (slug: string | null) => {
    startTransition(() => {
      setParentSlug(slug);
      setCategorySlug(null);
      setQuery("");
      setDraftQuery("");
      setPage(1);
    });
  };

  const selectSub = (slug: string | null) => {
    startTransition(() => {
      setCategorySlug(slug);
      setQuery("");
      setDraftQuery("");
      setPage(1);
    });
  };

  if (loadError) {
    return (
      <EmptyState icon={<Store size={28} />} title={labels.emptyTitle} body={labels.emptyBody} />
    );
  }

  if (!catalog) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-36 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
          <div className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-surface-2" />
        </div>
      </div>
    );
  }

  if (catalog.empty) {
    return (
      <EmptyState icon={<Store size={28} />} title={labels.emptyTitle} body={labels.emptyBody} />
    );
  }

  const activeMarket = market ? ordered.find((m) => m.retailer_key === market) ?? null : null;

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-gradient-to-br from-[color:var(--card-purple)] via-[color:var(--surface)] to-[color:var(--card-blue)] p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
          Glovo · Brașov
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-fg sm:text-2xl">{labels.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{labels.subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {ordered.map((item) => {
            const active = market === item.retailer_key;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectMarket(active ? null : item.retailer_key)}
                className={`${buttonClass(active ? "primary" : "secondary")} touch-manipulation`}
              >
                <span
                  className="mr-1.5 inline-flex size-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{ backgroundColor: item.brand_color ?? "var(--brand)" }}
                  aria-hidden
                >
                  {item.logo_emoji ?? item.name.slice(0, 1)}
                </span>
                {item.name}
              </button>
            );
          })}
        </div>

        {market ? (
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(() => {
                setQuery(draftQuery.trim());
                setPage(1);
              });
            }}
          >
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{labels.search}</span>
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
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

      {market ? (
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => selectMarket(null)} className="text-brand hover:underline">
            {labels.allMarkets}
          </button>
          {activeMarket ? (
            <>
              <span className="text-muted">/</span>
              <button
                type="button"
                onClick={() => selectParent(null)}
                className={!parentSlug && !query ? "font-semibold text-fg" : "text-brand hover:underline"}
              >
                {activeMarket.name}
              </button>
            </>
          ) : null}
          {parentSlug ? (
            <>
              <span className="text-muted">/</span>
              <button
                type="button"
                onClick={() => selectSub(null)}
                className={!categorySlug && !query ? "font-semibold text-fg" : "text-brand hover:underline"}
              >
                {parents.find((p) => p.slug === parentSlug)?.title || parentSlug}
              </button>
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

      {!market ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {ordered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectMarket(item.retailer_key)}
              className="block text-left"
            >
              <Card className="transition hover:border-brand/40">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex size-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
                    style={{ backgroundColor: item.brand_color ?? "var(--brand)" }}
                  >
                    {item.logo_emoji ?? item.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-semibold text-fg">{item.name}</p>
                    <p className="text-xs text-muted">Brașov · Glovo</p>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      ) : null}

      {showCategories ? (
        <CategoryGrid
          title={labels.categories}
          nodes={parents}
          onSelect={(node) => selectParent(node.slug)}
          empty={labels.noProductsInCategory}
        />
      ) : null}

      {showSubcategories ? (
        <CategoryGrid
          title={labels.subcategories}
          nodes={subcategories}
          onSelect={(node) => selectSub(node.slug)}
          empty={labels.noProductsInCategory}
          onBack={() => selectParent(null)}
          backLabel={labels.back}
        />
      ) : null}

      {showProducts && browse ? (
        <ProductGrid
          title={labels.products}
          browse={browse}
          locale={locale}
          labels={labels}
          onAdd={(product) => {
            const storeSlug =
              ordered.find((m) => m.retailer_key === product.retailer_key)?.store_slug ?? "";
            cart.add({
              id: product.id,
              name: product.name,
              priceDisplay:
                product.price_display ??
                formatMoney(toMinor(product.price ?? 0), product.currency || "RON", locale),
              imageUrl: product.image_url,
              retailer: product.retailer_key,
              storeSlug,
              glovoProductId: product.glovo_product_id,
            });
          }}
          onPage={(nextPage) => startTransition(() => setPage(nextPage))}
        />
      ) : null}

      <div className={cart.totalQty > 0 ? "h-20" : undefined} aria-hidden />
      <GlovoOrderBar
        lines={cart.lines}
        totalQty={cart.totalQty}
        onClear={cart.clear}
        onSetQty={cart.setQty}
        labels={{
          prepareOrder: labels.prepareOrder,
          itemsCount: labels.itemsCount,
          openInGlovo: labels.openInGlovo,
          clearCart: labels.clearCart,
          copyList: labels.copyList,
          copied: labels.copied,
          handoffNote: labels.handoffNote,
          emptyCart: labels.emptyCart,
        }}
      />
    </section>
  );
}

const TILE_TONES = [
  "bg-[#ffe8d6]",
  "bg-[#e8f6e9]",
  "bg-[#e7f0ff]",
  "bg-[#fde7f1]",
  "bg-[#fff4d6]",
  "bg-[#ece7ff]",
  "bg-[#e6faf7]",
  "bg-[#f2ebe4]",
];

function CategoryGrid({
  title,
  nodes,
  onSelect,
  empty,
  onBack,
  backLabel,
}: {
  title: string;
  nodes: GlovoCategoryNode[];
  onSelect: (node: GlovoCategoryNode) => void;
  empty: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {onBack && backLabel ? (
          <button
            type="button"
            onClick={onBack}
            className={`${buttonClass("ghost")} inline-flex min-h-11 items-center gap-1 touch-manipulation`}
          >
            <ChevronLeft size={16} />
            {backLabel}
          </button>
        ) : null}
      </div>
      {nodes.length === 0 ? (
        <EmptyState icon={<FolderOpen size={28} />} title={empty} />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {nodes.map((node, index) => {
            const tone = TILE_TONES[index % TILE_TONES.length]!;
            return (
              <button
                key={node.slug}
                type="button"
                onClick={() => onSelect(node)}
                className="group flex flex-col items-center gap-2 text-center touch-manipulation"
              >
                <span
                  className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[1.35rem] ${tone} shadow-sm ring-1 ring-black/5 transition duration-200 group-active:scale-[0.97] group-hover:shadow-md`}
                >
                  {node.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={node.image_url}
                      alt=""
                      className="size-[78%] object-contain drop-shadow-sm transition duration-300 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <FolderOpen size={28} className="text-black/35" aria-hidden />
                  )}
                  {node.product_count > 0 ? (
                    <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                      {node.product_count}
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 px-0.5 text-[12px] leading-tight font-semibold text-fg sm:text-[13px]">
                  {node.title}
                </span>
              </button>
            );
          })}
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
  onAdd,
  onPage,
}: {
  title: string;
  browse: GlovoBrowsePage;
  locale: string;
  labels: Labels;
  onAdd: (product: GlovoProduct) => void;
  onPage: (page: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <Badge tone="brand">{labels.items.replace("{count}", String(browse.total))}</Badge>
      </div>
      {browse.items.length === 0 ? (
        <EmptyState icon={<Store size={28} />} title={labels.noProductsInCategory} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {browse.items.map((product, index) => {
            const tone = TILE_TONES[index % TILE_TONES.length]!;
            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-sm"
              >
                <div className={`relative flex aspect-square items-center justify-center ${tone}`}>
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt=""
                      className="size-[82%] object-contain drop-shadow-sm"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Store size={28} className="text-black/30" aria-hidden />
                  )}
                  {product.out_of_stock ? (
                    <span className="absolute top-2 left-2">
                      <Badge tone="warn">{labels.outOfStock}</Badge>
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 p-2.5 sm:p-3">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-fg">
                    {product.name}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="tabular text-base font-bold text-fg">
                      {product.price_display ??
                        formatMoney(
                          toMinor(product.price ?? 0),
                          product.currency || "RON",
                          locale,
                        )}
                    </p>
                    <button
                      type="button"
                      disabled={product.out_of_stock}
                      onClick={() => onAdd(product)}
                      className={`${buttonClass("primary")} !min-h-9 !rounded-full !px-2.5 touch-manipulation disabled:opacity-40`}
                      aria-label={labels.addToCart}
                    >
                      <Plus size={16} aria-hidden />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
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
              <button
                type="button"
                onClick={() => onPage(browse.page - 1)}
                className={`${buttonClass("secondary")} inline-flex min-h-11 items-center gap-1 touch-manipulation`}
              >
                <ChevronLeft size={16} />
                {labels.prev}
              </button>
            ) : null}
            {browse.page < browse.totalPages ? (
              <button
                type="button"
                onClick={() => onPage(browse.page + 1)}
                className={`${buttonClass("secondary")} inline-flex min-h-11 items-center gap-1 touch-manipulation`}
              >
                {labels.next}
                <ChevronRight size={16} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
