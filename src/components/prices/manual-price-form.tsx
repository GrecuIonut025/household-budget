"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveManualPrice, type PriceActionState } from "@/app/actions/prices";
import { useI18n } from "@/lib/i18n/provider";
import { Sheet } from "../sheet";
import { SubmitButton } from "../submit-button";
import { Alert, Field, inputClass, buttonClass } from "../ui";

function ManualPriceForm({
  householdId,
  products,
  retailers,
  today,
  defaultProductId,
  onDone,
}: {
  householdId: string;
  products: { id: string; name: string }[];
  retailers: { id: string; name: string }[];
  today: string;
  defaultProductId?: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveManualPrice, {} as PriceActionState);
  const done = useRef(false);
  useEffect(() => {
    if (state.ok && !done.current) {
      done.current = true;
      onDone();
    }
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label={t("prices.product")} htmlFor="productId">
        <select id="productId" name="productId" required defaultValue={defaultProductId ?? ""} className={inputClass}>
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
      <Field label={t("prices.retailer")} htmlFor="retailerId">
        <select id="retailerId" name="retailerId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            —
          </option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("prices.price")} htmlFor="price">
        <input id="price" name="price" required inputMode="decimal" autoComplete="off" placeholder="0,00" className={`${inputClass} tabular`} />
      </Field>
      <Field label={t("prices.date")} htmlFor="observedOn">
        <input id="observedOn" name="observedOn" type="date" required max={today} defaultValue={today} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPromo" />
        {t("prices.promo")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="loyaltyRequired" />
        {t("prices.loyalty")}
      </label>
      <SubmitButton>{t("common.save")}</SubmitButton>
    </form>
  );
}

export function ManualPriceSheet({
  open,
  onClose,
  householdId,
  products,
  retailers,
  today,
  defaultProductId,
}: {
  open: boolean;
  onClose: () => void;
  householdId: string;
  products: { id: string; name: string }[];
  retailers: { id: string; name: string }[];
  currency: string;
  today: string;
  defaultProductId?: string;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={t("prices.manualAdd")}>
      <ManualPriceForm
        householdId={householdId}
        products={products}
        retailers={retailers}
        today={today}
        defaultProductId={defaultProductId}
        onDone={onClose}
      />
    </Sheet>
  );
}

export function ManualPriceButton(
  props: Omit<Parameters<typeof ManualPriceSheet>[0], "open" | "onClose"> & { className?: string },
) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={props.className ?? buttonClass("secondary")} onClick={() => setOpen(true)}>
        {t("prices.manualAdd")}
      </button>
      <ManualPriceSheet {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
