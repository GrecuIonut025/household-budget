import Link from "next/link";
import { Search, Store } from "lucide-react";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { GlovoComparisonGroup, GlovoMarket, GlovoRetailerKey } from "@/lib/glovo/types";
import { formatMoney, toMinor } from "@/lib/money";

const RETAILER_ORDER: GlovoRetailerKey[] = ["profi", "carrefour", "kaufland", "mega_image"];

export function GlovoBrasovSection({
  markets,
  groups,
  query,
  retailer,
  locale,
  labels,
}: {
  markets: GlovoMarket[];
  groups: GlovoComparisonGroup[];
  query: string;
  retailer: GlovoRetailerKey | null;
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    search: string;
    allMarkets: string;
    cheapest: string;
    spread: string;
    emptyTitle: string;
    emptyBody: string;
    outOfStock: string;
    sourceNote: string;
    results: string;
  };
}) {
  const marketByKey = new Map(markets.map((m) => [m.retailer_key, m]));
  const orderedMarkets = RETAILER_ORDER.map((key) => marketByKey.get(key)).filter(
    (m): m is GlovoMarket => Boolean(m),
  );

  return (
    <section className="mb-8 space-y-4">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-gradient-to-br from-[color:var(--card-purple)] via-[color:var(--surface)] to-[color:var(--card-blue)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              Glovo · Brașov
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-fg sm:text-xl">
              {labels.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{labels.subtitle}</p>
          </div>
          <Badge tone="brand">{labels.results}</Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {orderedMarkets.map((market) => {
            const active = retailer === market.retailer_key;
            const href = buildHref({
              q: query,
              market: active ? null : market.retailer_key,
            });
            return (
              <Link
                key={market.id}
                href={href}
                className={buttonClass(active ? "primary" : "secondary")}
                style={
                  !active && market.brand_color
                    ? { borderColor: `${market.brand_color}55` }
                    : undefined
                }
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
          {retailer ? (
            <Link href={buildHref({ q: query, market: null })} className={buttonClass("ghost")}>
              {labels.allMarkets}
            </Link>
          ) : null}
        </div>

        <form action="/price-comparison" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
          {retailer ? <input type="hidden" name="market" value={retailer} /> : null}
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
        <p className="mt-3 text-xs text-muted">{labels.sourceNote}</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Store size={28} />}
          title={labels.emptyTitle}
          body={labels.emptyBody}
        />
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <Card key={group.key} className="!p-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="flex items-center gap-3 border-b border-border p-4 sm:w-64 sm:shrink-0 sm:border-r sm:border-b-0">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                    {group.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={group.imageUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Store size={22} className="text-muted" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-semibold text-fg sm:text-base">
                      {group.name}
                    </h3>
                    {group.category ? (
                      <p className="mt-0.5 text-xs text-muted">{group.category}</p>
                    ) : null}
                  </div>
                </div>

                <ul className="min-w-0 flex-1 divide-y divide-border">
                  {group.quotes.map((quote) => {
                    const cheapest = group.cheapestRetailerKey === quote.retailerKey;
                    return (
                      <li
                        key={`${group.key}-${quote.retailerKey}-${quote.productId}`}
                        className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                      >
                        <span
                          className="inline-flex size-7 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                          style={{ backgroundColor: quote.brandColor ?? "var(--brand)" }}
                          aria-hidden
                        >
                          {quote.logoEmoji ?? quote.marketName.slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{quote.marketName}</span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {cheapest ? <Badge tone="ok">{labels.cheapest}</Badge> : null}
                            {quote.outOfStock ? (
                              <Badge tone="warn">{labels.outOfStock}</Badge>
                            ) : null}
                          </span>
                        </span>
                        <span
                          className={`tabular text-base font-semibold ${cheapest ? "text-ok" : "text-fg"}`}
                        >
                          {quote.priceDisplay ??
                            formatMoney(toMinor(quote.price), quote.currency, locale)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {group.spread != null ? (
                <p className="border-t border-border px-4 py-2 text-xs text-muted">
                  {labels.spread}:{" "}
                  {formatMoney(toMinor(group.spread), group.quotes[0]?.currency ?? "RON", locale)}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function buildHref({
  q,
  market,
}: {
  q: string;
  market: GlovoRetailerKey | null;
}): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (market) params.set("market", market);
  const qs = params.toString();
  return qs ? `/price-comparison?${qs}` : "/price-comparison";
}
