import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { NewListButton } from "@/components/shopping/list-forms";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { requireAppContext } from "@/lib/data/context";
import { getShoppingLists } from "@/lib/data/shopping-lists";
import { canWrite } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.shoppingLists") };
}

export default async function ShoppingListsPage() {
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);
  const lists = await getShoppingLists(household.id);

  return (
    <>
      <PageHeader
        title={t("nav.shoppingLists")}
        subtitle={t("shopping.subtitle")}
        action={writer ? <NewListButton householdId={household.id} /> : undefined}
      />

      {lists.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingCart size={32} aria-hidden />}
            title={t("shopping.empty.title")}
            body={t("shopping.empty.body")}
            action={
              writer ? (
                <Link href="/meal-planner" className={buttonClass("secondary")}>
                  {t("shopping.fromPlan")}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/shopping-lists/${list.id}`}
                className="block rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition hover:border-brand/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight">{list.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t("shopping.checked", { checked: list.checked_count, total: list.item_count })}
                      {list.meal_week_start
                        ? ` · ${formatDate(list.meal_week_start, locale, { day: "numeric", month: "short" })}`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    tone={list.status === "completed" ? "ok" : list.status === "draft" ? "default" : "brand"}
                  >
                    {t(`shopping.status.${list.status}` as MessageKey)}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">{t("shopping.items", { count: list.item_count })}</span>
                  <span className="tabular font-medium">
                    {list.estimated_total === null
                      ? "—"
                      : formatMoney(toMinor(list.estimated_total), household.currency, locale)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!writer ? <p className="mt-4 text-center text-xs text-muted">{t("common.viewOnly")}</p> : null}
    </>
  );
}
