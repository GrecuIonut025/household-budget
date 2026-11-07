"use client";

import { Trash2 } from "lucide-react";
import { deleteShoppingItem, toggleShoppingItem } from "@/app/actions/shopping-lists";
import type { ShoppingListItemRow } from "@/lib/data/shopping-lists";
import { formatMoney, toMinor } from "@/lib/money";
import { useI18n } from "@/lib/i18n/provider";
import { ConfirmForm } from "@/components/confirm-form";

export function ShoppingItemList({
  householdId,
  items,
  currency,
  canWrite,
  retailerNames,
}: {
  householdId: string;
  items: ShoppingListItemRow[];
  currency: string;
  canWrite: boolean;
  retailerNames: Record<string, string>;
}) {
  const { t, locale } = useI18n();

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{t("shopping.empty.body")}</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {items.map((item) => {
        const unitPrice = item.actual_unit_price ?? item.estimated_unit_price;
        const lineTotal = unitPrice === null ? null : toMinor(unitPrice * item.quantity);
        return (
          <li key={item.id} className="flex items-start gap-3 px-3 py-3">
            {canWrite ? (
              <form action={toggleShoppingItem} className="pt-0.5">
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="checked" value={item.is_checked ? "false" : "true"} />
                <button
                  type="submit"
                  aria-pressed={item.is_checked}
                  aria-label={t("shopping.markBought")}
                  className={`grid size-6 place-items-center rounded-md border ${
                    item.is_checked ? "border-ok bg-ok text-white" : "border-border bg-surface"
                  }`}
                >
                  {item.is_checked ? "✓" : null}
                </button>
              </form>
            ) : (
              <span
                className={`mt-0.5 grid size-6 place-items-center rounded-md border ${
                  item.is_checked ? "border-ok bg-ok text-white" : "border-border"
                }`}
              >
                {item.is_checked ? "✓" : null}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${item.is_checked ? "text-muted line-through" : ""}`}>{item.name}</p>
              <p className="text-xs text-muted">
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
                {item.retailer_id && retailerNames[item.retailer_id] ? ` · ${retailerNames[item.retailer_id]}` : ""}
              </p>
            </div>

            <div className="text-right">
              {lineTotal !== null ? (
                <p className="tabular text-sm font-medium">{formatMoney(lineTotal, currency, locale)}</p>
              ) : (
                <p className="text-xs text-muted">—</p>
              )}
              {canWrite && !item.is_checked ? (
                <ConfirmForm action={deleteShoppingItem} message={t("common.delete")} className="mt-1 inline-flex">
                  <input type="hidden" name="householdId" value={householdId} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button type="submit" className="text-muted hover:text-danger" aria-label={t("common.delete")}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                </ConfirmForm>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
