"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { recordPurchase } from "@/app/actions/products";
import type { MemberRow } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney, moneyInputValue, parseMoneyInput } from "@/lib/money";
import type { ProductRow, RetailerRow } from "@/lib/products/types";
import { Sheet } from "../sheet";
import { SubmitButton } from "../submit-button";
import { Alert, Field, inputClass } from "../ui";

interface PurchaseFormProps {
  product: Pick<ProductRow, "id" | "name" | "unit" | "last_price" | "last_retailer_id" | "preferred_retailer_id">;
  retailers: RetailerRow[];
  members: MemberRow[];
  currentUserId: string;
  currency: string;
  today: string;
  onDone: () => void;
}

function PurchaseFormBody({ product, retailers, members, currentUserId, currency, today, onDone }: PurchaseFormProps) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(recordPurchase, {});
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(moneyInputValue(product.last_price, locale));
  const [scope, setScope] = useState<"shared" | "individual">("shared");
  const finished = useRef(false);

  useEffect(() => {
    if (state.ok && !finished.current) {
      finished.current = true;
      onDone();
    }
  }, [state.ok, onDone]);

  const q = Number(quantity.replace(",", "."));
  const priceMinor = parseMoneyInput(unitPrice);
  const total = Number.isFinite(q) && q > 0 && priceMinor !== null ? Math.round(q * priceMinor) : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={product.id} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t("products.purchaseQuantity")} (${t(`products.unit.${product.unit}`)})`} htmlFor="quantity">
          <input
            id="quantity"
            name="quantity"
            required
            inputMode="decimal"
            autoComplete="off"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`${inputClass} tabular text-lg font-semibold`}
          />
        </Field>
        <Field label={t("products.purchaseUnitPrice")} htmlFor="unitPrice">
          <input
            id="unitPrice"
            name="unitPrice"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className={`${inputClass} tabular text-lg font-semibold`}
          />
        </Field>
      </div>
      {total !== null ? (
        <p className="tabular text-sm text-muted">
          {t("products.purchaseTotal")}: <span className="font-semibold text-fg">{formatMoney(total, currency, locale)}</span>
        </p>
      ) : null}
      <Field label={t("tx.date")} htmlFor="purchasedOn">
        <input id="purchasedOn" name="purchasedOn" type="date" required max={today} defaultValue={today} className={inputClass} />
      </Field>
      <Field label={t("products.purchaseRetailer")} htmlFor="retailerId">
        <select
          id="retailerId"
          name="retailerId"
          defaultValue={product.preferred_retailer_id ?? product.last_retailer_id ?? ""}
          className={inputClass}
        >
          <option value="">{t("products.noRetailer")}</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("products.purchaseBuyer")} htmlFor="purchasedBy">
        <select id="purchasedBy" name="purchasedBy" defaultValue={currentUserId} className={inputClass}>
          {scope === "shared" ? <option value="">{t("common.unattributed")}</option> : null}
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}
              {m.user_id === currentUserId ? ` (${t("common.you")})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("tx.scope")} hint={t("tx.scopeHint")} htmlFor="scope">
        <select id="scope" name="scope" value={scope} onChange={(e) => setScope(e.target.value as "shared" | "individual")} className={inputClass}>
          <option value="shared">{t("common.shared")}</option>
          <option value="individual">{t("common.individual")}</option>
        </select>
      </Field>
      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
        <input type="checkbox" name="isPromo" className="size-5 accent-brand" />
        {t("products.purchasePromo")}
      </label>
      <p className="text-xs text-muted">{t("products.purchaseHint")}</p>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
    </form>
  );
}

export function PurchaseSheet({ open, onClose, ...props }: Omit<PurchaseFormProps, "onDone"> & { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={`${t("products.recordPurchase")} · ${props.product.name}`}>
      <PurchaseFormBody {...props} onDone={onClose} />
    </Sheet>
  );
}
