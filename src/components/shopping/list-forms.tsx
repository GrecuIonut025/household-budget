"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addShoppingItem,
  completeShoppingList,
  createShoppingList,
  releaseShoppingReservation,
  reserveShoppingBudget,
} from "@/app/actions/shopping-lists";
import { moneyInputValue } from "@/lib/money";
import { useI18n } from "@/lib/i18n/provider";
import { ConfirmForm } from "@/components/confirm-form";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";

export function NewListButton({ householdId }: { householdId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createShoppingList, {});

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        {t("shopping.new")}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("shopping.new")}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="householdId" value={householdId} />
          <Field label={t("shopping.listName")} htmlFor="name">
            <input id="name" name="name" required className={inputClass} maxLength={120} autoFocus />
          </Field>
          {state.error ? <Alert>{state.error}</Alert> : null}
          <SubmitButton className="w-full">{t("common.create")}</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

export function ReserveBudgetForm({
  householdId,
  listId,
  defaultAmount,
  locale,
}: {
  householdId: string;
  listId: string;
  defaultAmount: number | null;
  locale: string;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(reserveShoppingBudget, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="listId" value={listId} />
      <p className="text-xs text-muted">{t("shopping.reserve.hint")}</p>
      <Field label={t("shopping.reserve.amount")} htmlFor="amount">
        <input
          id="amount"
          name="amount"
          required
          inputMode="decimal"
          defaultValue={moneyInputValue(defaultAmount, locale)}
          className={inputClass}
        />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <SubmitButton className="w-full">{t("shopping.reserve")}</SubmitButton>
    </form>
  );
}

export function ReleaseReservationButton({ householdId, listId }: { householdId: string; listId: string }) {
  const { t } = useI18n();
  return (
    <form action={releaseShoppingReservation}>
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="listId" value={listId} />
      <button type="submit" className={buttonClass("ghost", "w-full")}>
        {t("shopping.reserve.release")}
      </button>
    </form>
  );
}

export function CompleteListForm({
  householdId,
  listId,
  today,
}: {
  householdId: string;
  listId: string;
  today: string;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(completeShoppingList, {});

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{t("shopping.complete.hint")}</p>
      <p className="text-xs font-medium text-muted">{t("shopping.neverAuto")}</p>
      <ConfirmForm action={action} message={t("shopping.complete.confirm")} className="space-y-3">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="listId" value={listId} />
        <input type="hidden" name="occurredOn" value={today} />
        <input type="hidden" name="scope" value="shared" />
        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton className="w-full" variant="primary">
          {t("shopping.complete")}
        </SubmitButton>
      </ConfirmForm>
    </div>
  );
}

function AddItemSheet({
  householdId,
  listId,
  open,
  onClose,
}: {
  householdId: string;
  listId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(addShoppingItem, {});

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Sheet open={open} onClose={onClose} title={t("shopping.addItem")}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="householdId" value={householdId} />
        <input type="hidden" name="listId" value={listId} />
        <Field label={t("shopping.itemName")} htmlFor="itemName">
          <input id="itemName" name="name" required className={inputClass} maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("shopping.quantity")} htmlFor="quantity">
            <input id="quantity" name="quantity" type="number" min={0.001} step="any" defaultValue={1} className={inputClass} />
          </Field>
          <Field label={t("shopping.unit")} htmlFor="unit">
            <input id="unit" name="unit" className={inputClass} placeholder="pcs" />
          </Field>
        </div>
        {state.error ? <Alert>{state.error}</Alert> : null}
        <SubmitButton className="w-full">{t("common.add")}</SubmitButton>
      </form>
    </Sheet>
  );
}

export function AddItemForm({ householdId, listId }: { householdId: string; listId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary")}>
        {t("shopping.addItem")}
      </button>
      {open ? (
        <AddItemSheet
          householdId={householdId}
          listId={listId}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
