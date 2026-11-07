import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Archive, Trash2 } from "lucide-react";
import { deleteProduct, setProductFlag } from "@/app/actions/products";
import { ConfirmForm } from "@/components/confirm-form";
import { ProductActions } from "@/components/products/product-actions";
import { FavoriteButton } from "@/components/products/product-flag-button";
import { ProductThumb } from "@/components/products/product-thumb";
import { Badge, Card, CardTitle, EmptyState, Stat, buttonClass } from "@/components/ui";
import { getMembers, requireAppContext } from "@/lib/data/context";
import { ManualPriceButton } from "@/components/prices/manual-price-form";
import { PriceHistoryChart } from "@/components/prices/price-history-chart";
import { getProduct, getProductPrices, getPurchaseHistory, getRetailers, signProductImages } from "@/lib/data/products";
import { listPriceHistory } from "@/lib/data/prices";
import { canWrite } from "@/lib/data/types";
import { formatDate, todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";
import { productCategoryLabel } from "@/lib/products/labels";
import { OFF_ATTRIBUTION } from "@/lib/products/open-food-facts";

type Params = { id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const { t } = await getTranslator();
  if (!UUID.test(id)) return { title: t("products.title") };
  const ctx = await requireAppContext();
  const product = await getProduct(ctx.active.household.id, id);
  return { title: product?.name ?? t("products.title") };
}

export default async function ProductDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const product = await getProduct(household.id, id);
  if (!product) notFound();

  const [history, prices, retailers, members, images, priceHistory] = await Promise.all([
    getPurchaseHistory(household.id, id),
    getProductPrices(household.id, [id]),
    getRetailers(),
    getMembers(household.id),
    signProductImages([product.image_path]),
    listPriceHistory(household.id, id),
  ]);
  const writer = canWrite(role);
  const today = todayFor(household.timezone);
  const imageUrl = product.image_path ? (images.get(product.image_path) ?? null) : null;
  const retailerName = new Map(retailers.map((r) => [r.id, r.name]));
  const memberName = new Map(members.map((m) => [m.user_id, m.display_name]));
  const money = (value: number | null) => (value === null ? "—" : formatMoney(toMinor(value), household.currency, locale));
  const size = product.package_size && product.package_unit ? `${product.package_size} ${t(`products.unit.${product.package_unit}`)}` : null;
  const subtitle = [product.brand, size, product.category ? productCategoryLabel(t, product.category) : null].filter(Boolean).join(" · ");
  const hasPurchases = product.purchase_count > 0;

  return (
    <>
      <Link href="/products" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-fg">
        <ChevronLeft size={18} aria-hidden />
        {t("products.title")}
      </Link>

      <header className="mb-5 flex items-start gap-4">
        <ProductThumb url={imageUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.is_frequent ? <Badge tone="brand">{t("products.frequent")}</Badge> : null}
            {product.is_archived ? <Badge tone="warn">{t("products.archived")}</Badge> : null}
            {product.preferred_retailer_id && retailerName.get(product.preferred_retailer_id) ? (
              <Badge>{t("products.preferredAt", { retailer: retailerName.get(product.preferred_retailer_id) ?? "" })}</Badge>
            ) : null}
          </div>
        </div>
        {writer ? <FavoriteButton productId={product.id} active={product.is_favorite} label={t(product.is_favorite ? "products.unfavorite" : "products.favorite")} /> : null}
      </header>

      {writer ? (
        <div className="mb-5">
          <ProductActions
            householdId={household.id}
            product={product}
            imageUrl={imageUrl}
            retailers={retailers}
            members={members}
            currentUserId={ctx.user.id}
            currency={household.currency}
            today={today}
          />
        </div>
      ) : null}

      <Card className="mb-4">
        <CardTitle>{t("products.stats")}</CardTitle>
        {hasPurchases ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <Stat label={t("products.statCount")} value={product.purchase_count} />
            <Stat label={t("products.statQuantity")} value={`${Number(product.total_quantity.toFixed(3))} ${t(`products.unit.${product.unit}`)}`} />
            <Stat label={t("products.statSpent")} value={money(product.total_spent)} />
            <Stat label={t("products.statAvg")} value={money(product.avg_price)} />
            <Stat label={t("products.statLast")} value={money(product.last_price)} hint={product.last_purchase_date ? formatDate(product.last_purchase_date, locale, { day: "numeric", month: "short", year: "numeric" }) : undefined} />
            <Stat label={t("products.statMin")} value={money(product.min_price)} tone="ok" />
            <Stat label={t("products.statMax")} value={money(product.max_price)} />
            <Stat
              label={t("products.statLastDate")}
              value={product.last_purchase_date ? formatDate(product.last_purchase_date, locale) : "—"}
              hint={product.last_retailer_id ? retailerName.get(product.last_retailer_id) : undefined}
            />
          </div>
        ) : (
          <EmptyState title={t("products.statsEmptyTitle")} body={t("products.statsEmptyBody")} />
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle>{t("products.historyTitle")}</CardTitle>
        {history.length === 0 ? (
          <EmptyState title={t("products.historyEmpty")} />
        ) : (
          <ul className="-mx-1 divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-1 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {formatDate(h.purchased_on, locale, { day: "numeric", month: "short", year: "numeric" })}
                    {h.is_promo ? <span className="ml-2 align-middle"><Badge tone="ok">{t("products.promo")}</Badge></span> : null}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[
                      `${Number(h.quantity.toFixed(3))} × ${money(h.unit_price)}`,
                      h.retailer_id ? retailerName.get(h.retailer_id) : null,
                      h.purchased_by ? memberName.get(h.purchased_by) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-semibold">{money(h.total_price)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle>{t("products.barcodesTitle")}</CardTitle>
        {product.barcodes.length === 0 ? (
          <p className="text-sm text-muted">{t("products.barcodesEmpty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {product.barcodes.map((b) => (
              <li key={b} className="rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-sm">
                {b}
              </li>
            ))}
          </ul>
        )}
        {product.data_source === "open_food_facts" ? (
          <p className="mt-3 text-xs text-muted">
            {t("products.offAttribution")}{" "}
            <a href={OFF_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer" className="underline">
              {OFF_ATTRIBUTION.name}
            </a>{" "}
            (
            <a href={OFF_ATTRIBUTION.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {OFF_ATTRIBUTION.licenseName}
            </a>
            )
          </p>
        ) : null}
      </Card>

      <Card className="mb-4">
        <CardTitle
          action={
            writer ? (
              <ManualPriceButton
                householdId={household.id}
                products={[{ id: product.id, name: product.name }]}
                retailers={retailers}
                currency={household.currency}
                today={today}
                defaultProductId={product.id}
                className="text-sm font-medium text-brand hover:underline"
              />
            ) : undefined
          }
        >
          {t("products.pricesTitle")}
        </CardTitle>
        {prices.length === 0 ? (
          <EmptyState title={t("prices.noQuotes")} />
        ) : (
          <ul className="-mx-1 divide-y divide-border">
            {[...prices]
              .sort((a, b) => a.price - b.price)
              .map((p) => (
                <li key={`${p.retailer_id}-${p.observed_at}`} className="flex items-center justify-between gap-3 px-1 py-2.5 text-sm">
                  <span>
                    {retailerName.get(p.retailer_id) ?? "—"}
                    {p.is_promo ? <span className="ml-2"><Badge tone="ok">{t("products.promo")}</Badge></span> : null}
                  </span>
                  <span className="tabular font-semibold">{formatMoney(toMinor(p.price), p.currency, locale)}</span>
                </li>
              ))}
          </ul>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("prices.historyTitle")}</p>
          <PriceHistoryChart
            points={priceHistory}
            retailers={retailers}
            currency={household.currency}
            locale={locale}
            empty={t("prices.historyEmpty")}
          />
        </div>
      </Card>

      {product.notes ? (
        <Card className="mb-4">
          <CardTitle>{t("products.notes")}</CardTitle>
          <p className="whitespace-pre-wrap text-sm">{product.notes}</p>
        </Card>
      ) : null}

      {writer ? (
        <div className="flex flex-wrap gap-2">
          <form action={setProductFlag}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="field" value="is_archived" />
            <input type="hidden" name="value" value={String(!product.is_archived)} />
            <button type="submit" className={buttonClass("secondary")}>
              <Archive size={18} aria-hidden />
              {product.is_archived ? t("products.unarchive") : t("products.archive")}
            </button>
          </form>
          {!hasPurchases ? (
            <ConfirmForm action={deleteProduct} message={t("products.deleteConfirm")}>
              <input type="hidden" name="id" value={product.id} />
              <button type="submit" className={buttonClass("danger")}>
                <Trash2 size={18} aria-hidden />
                {t("common.delete")}
              </button>
            </ConfirmForm>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
