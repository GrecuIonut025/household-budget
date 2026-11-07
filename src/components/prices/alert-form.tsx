"use client";

import { useActionState } from "react";
import { deletePriceAlert, savePriceAlert, togglePriceAlert, type PriceActionState } from "@/app/actions/prices";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney, toMinor } from "@/lib/money";
import type { PriceAlertRow } from "@/lib/prices/types";
import { SubmitButton } from "../submit-button";
import { Alert, Field, inputClass, buttonClass } from "../ui";

export function AlertCreateForm({
  householdId,
  products,
  retailers,
}: {
  householdId: string;
  products: { id: string; name: string }[];
  retailers: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(savePriceAlert, {} as PriceActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="householdId" value={householdId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <Field label={t("prices.product")} htmlFor="alertProductId">
        <select id="alertProductId" name="productId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            —
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("prices.retailer")} htmlFor="alertRetailerId">
        <select id="alertRetailerId" name="retailerId" defaultValue="" className={inputClass}>
          <option value="">{t("prices.alertAnyRetailer")}</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("prices.alertBelow")} htmlFor="direction">
          <select id="direction" name="direction" className={inputClass} defaultValue="below">
            <option value="below">{t("prices.alertBelow")}</option>
            <option value="above">{t("prices.alertAbove")}</option>
          </select>
        </Field>
        <Field label={t("prices.price")} htmlFor="targetPrice">
          <input id="targetPrice" name="targetPrice" required inputMode="decimal" className={`${inputClass} tabular`} />
        </Field>
      </div>
      <SubmitButton>{t("prices.alertCreate")}</SubmitButton>
    </form>
  );
}

export function AlertsList({
  householdId,
  alerts,
  products,
  retailers,
  currency,
  locale,
}: {
  householdId: string;
  alerts: PriceAlertRow[];
  products: { id: string; name: string }[];
  retailers: { id: string; name: string }[];
  currency: string;
  locale: string;
}) {
  const { t } = useI18n();
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const retailerName = new Map(retailers.map((r) => [r.id, r.name]));
  if (alerts.length === 0) return <p className="text-sm text-muted">{t("prices.alertsEmpty")}</p>;
  return (
    <ul className="-mx-1 divide-y divide-border">
      {alerts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 px-1 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{productName.get(a.productId) ?? "—"}</span>
            <span className="block text-xs text-muted">
              {a.direction === "below" ? t("prices.alertBelow") : t("prices.alertAbove")}{" "}
              {formatMoney(toMinor(a.targetPrice), currency, locale)}
              {" · "}
              {a.retailerId ? retailerName.get(a.retailerId) : t("prices.alertAnyRetailer")}
              {" · "}
              {a.isActive ? t("prices.alertActive") : t("prices.alertPaused")}
              {a.lastTriggeredPrice != null
                ? ` · ${t("prices.alertTriggered", { price: formatMoney(toMinor(a.lastTriggeredPrice), currency, locale) })}`
                : null}
            </span>
          </span>
          <form action={togglePriceAlert}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="isActive" value={String(a.isActive)} />
            <button type="submit" className={buttonClass("secondary")}>
              {t("prices.alertToggle")}
            </button>
          </form>
          <form action={deletePriceAlert}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className={buttonClass("danger")}>
              {t("common.delete")}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
