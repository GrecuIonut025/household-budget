import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  AddItemForm,
  CompleteListForm,
  ReleaseReservationButton,
  ReserveBudgetForm,
} from "@/components/shopping/list-forms";
import { ShoppingItemList } from "@/components/shopping/item-list";
import { StrategyCards } from "@/components/shopping/strategy-cards";
import { ConfirmForm } from "@/components/confirm-form";
import { Alert, Badge, Card, CardTitle, PageHeader, Stat, buttonClass } from "@/components/ui";
import { archiveShoppingList, deleteShoppingList } from "@/app/actions/shopping-lists";
import { requireAppContext } from "@/lib/data/context";
import { getRetailers, getShoppingList } from "@/lib/data/shopping-lists";
import { createSupabasePricingLookup } from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import { todayFor } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";
import { lookupPricing } from "@/lib/recipes/pricing";
import { compareStrategies, priceShoppingNeeds } from "@/lib/shopping";
import type { ShoppingNeed } from "@/lib/shopping/types";
import { parseUnit } from "@/lib/units";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.shoppingLists") };
}

export default async function ShoppingListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);
  const today = todayFor(household.timezone);

  const [list, retailers] = await Promise.all([getShoppingList(household.id, id), getRetailers()]);
  if (!list) notFound();

  const retailerNames = Object.fromEntries(retailers.map((r) => [r.id, r.name]));

  const productIds = list.items.map((i) => i.product_id).filter((pid): pid is string => !!pid);
  const lookup = await createSupabasePricingLookup({
    householdId: household.id,
    currency: household.currency,
    today,
  });
  const pricing = await lookupPricing(lookup, productIds);

  const needs: ShoppingNeed[] = list.items.map((item) => ({
    key: item.product_id ? `p:${item.product_id}` : `n:${item.name.toLowerCase()}:${item.unit ?? ""}`,
    name: item.name,
    productId: item.product_id,
    quantity: item.quantity,
    unit: parseUnit(item.unit),
    isOptional: false,
    sources: [],
    notes: item.note ? [item.note] : [],
    toBuyQuantity: item.quantity,
    coveredByPantry: 0,
    coveredFraction: 0,
    skippedAtHome: false,
  }));
  const lines = priceShoppingNeeds(needs, pricing);
  const strategies = compareStrategies({
    lines,
    pricing,
    preferredRetailerId: list.preferred_retailer_id,
  });

  let estimatedMinor: number | null = null;
  for (const item of list.items) {
    const price = item.actual_unit_price ?? item.estimated_unit_price;
    if (price === null) continue;
    estimatedMinor = (estimatedMinor ?? 0) + toMinor(price * item.quantity);
  }

  const money = (minor: number | null) => (minor === null ? "—" : formatMoney(minor, household.currency, locale));
  const open = list.status !== "completed" && list.status !== "archived";

  return (
    <>
      <div className="mb-3">
        <Link href="/shopping-lists" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
          <ArrowLeft size={16} aria-hidden />
          {t("nav.shoppingLists")}
        </Link>
      </div>

      <PageHeader
        title={list.name}
        subtitle={t("shopping.detail.subtitle")}
        action={<Badge tone={list.status === "completed" ? "ok" : "brand"}>{t(`shopping.status.${list.status}` as MessageKey)}</Badge>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card>
          <Stat label={t("shopping.estimated")} value={money(estimatedMinor)} />
        </Card>
        <Card>
          <Stat
            label={t("shopping.reserved")}
            value={list.reservation_amount === null ? t("shopping.notReserved") : formatMoney(toMinor(list.reservation_amount), household.currency, locale)}
            tone={list.reservation_amount ? "ok" : "default"}
          />
        </Card>
      </div>

      {open && writer ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <AddItemForm householdId={household.id} listId={list.id} />
        </div>
      ) : null}

      <div className="mb-5">
        <ShoppingItemList
          householdId={household.id}
          items={list.items}
          currency={household.currency}
          canWrite={writer && open}
          retailerNames={retailerNames}
        />
      </div>

      <div className="mb-5">
        <StrategyCards strategies={strategies} currency={household.currency} locale={locale} t={t} />
      </div>

      {open && writer ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>{t("shopping.reserve")}</CardTitle>
            <ReserveBudgetForm
              householdId={household.id}
              listId={list.id}
              defaultAmount={
                list.reservation_amount ??
                (estimatedMinor === null ? list.planned_budget : fromMinor(estimatedMinor))
              }
              locale={locale}
            />
            {list.reservation_id ? (
              <div className="mt-2">
                <ReleaseReservationButton householdId={household.id} listId={list.id} />
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>{t("shopping.complete")}</CardTitle>
            <CompleteListForm householdId={household.id} listId={list.id} today={today} />
          </Card>

          <div className="flex flex-wrap gap-2">
            <ConfirmForm action={archiveShoppingList} message={t("shopping.archive")}>
              <input type="hidden" name="householdId" value={household.id} />
              <input type="hidden" name="listId" value={list.id} />
              <button type="submit" className={buttonClass("secondary")}>
                {t("shopping.archive")}
              </button>
            </ConfirmForm>
            <ConfirmForm action={deleteShoppingList} message={t("shopping.deleteConfirm")}>
              <input type="hidden" name="householdId" value={household.id} />
              <input type="hidden" name="listId" value={list.id} />
              <button type="submit" className={buttonClass("danger")}>
                {t("shopping.delete")}
              </button>
            </ConfirmForm>
          </div>
        </div>
      ) : null}

      {list.status === "completed" ? (
        <Alert tone="ok">{t("shopping.complete.ok", { count: list.items.filter((i) => i.is_checked).length })}</Alert>
      ) : null}

      {!writer ? <p className="mt-4 text-center text-xs text-muted">{t("common.viewOnly")}</p> : null}
    </>
  );
}
