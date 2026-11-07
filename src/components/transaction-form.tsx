"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { deleteTransaction, saveTransaction } from "@/app/actions/transactions";
import { moneyInputValue } from "@/lib/money";
import type { CategoryRow, MemberRow, TransactionRow } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/provider";
import { categoryLabel } from "@/lib/i18n/category";
import { ConfirmForm } from "./confirm-form";
import { Sheet } from "./sheet";
import { SubmitButton } from "./submit-button";
import { Alert, Field, buttonClass, inputClass } from "./ui";

function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1">
      <input type="hidden" name={name} value={value} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "min-h-10 rounded-lg px-3 text-sm font-medium transition",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface TransactionFormProps {
  householdId: string;
  categories: CategoryRow[];
  members: MemberRow[];
  currentUserId: string;
  transaction?: TransactionRow | null;
  today: string;
  onDone: () => void;
}

function TransactionFormBody({ householdId, categories, members, currentUserId, transaction, today, onDone }: TransactionFormProps) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(saveTransaction, {});
  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? "expense");
  const [scope, setScope] = useState<"shared" | "individual">(transaction?.scope ?? "shared");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  async function deleteAndClose(formData: FormData) {
    await deleteTransaction(formData);
    onDone();
  }

  const visibleCategories = categories.filter((c) => c.kind === type && (!c.is_archived || c.id === transaction?.category_id));
  const categoryName = (c: CategoryRow) => categoryLabel(t, c);

  return (
    <>
    <form action={action} className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}
      <Segmented
        name="type"
        label={t("tx.title")}
        value={type}
        onChange={setType}
        options={[
          { value: "expense", label: t("common.expense") },
          { value: "income", label: t("common.income") },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("tx.amount")} htmlFor="amount">
          <input
            id="amount"
            name="amount"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            defaultValue={transaction ? moneyInputValue(transaction.amount, locale) : ""}
            className={clsx(inputClass, "tabular text-lg font-semibold")}
          />
        </Field>
        <Field label={t("tx.date")} htmlFor="occurredOn">
          <input id="occurredOn" name="occurredOn" type="date" required defaultValue={transaction?.occurred_on ?? today} className={inputClass} />
        </Field>
      </div>
      <Field label={t("tx.description")} htmlFor="description">
        <input id="description" name="description" maxLength={300} defaultValue={transaction?.description ?? ""} className={inputClass} />
      </Field>
      <Field label={t("tx.category")} htmlFor="categoryId">
        <select id="categoryId" name="categoryId" key={type} defaultValue={transaction?.type === type ? (transaction.category_id ?? "") : ""} className={inputClass}>
          <option value="">{t("tx.noCategory")}</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryName(c)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("tx.scope")} hint={t("tx.scopeHint")}>
        <Segmented
          name="scope"
          label={t("tx.scope")}
          value={scope}
          onChange={setScope}
          options={[
            { value: "shared", label: t("common.shared") },
            { value: "individual", label: t("common.individual") },
          ]}
        />
      </Field>
      <Field label={t("tx.paidBy")} htmlFor="paidBy">
        <select id="paidBy" name="paidBy" defaultValue={transaction ? (transaction.paid_by ?? "") : currentUserId} className={inputClass}>
          {scope === "shared" ? <option value="">{t("common.unattributed")}</option> : null}
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}
              {m.user_id === currentUserId ? ` (${t("common.you")})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${t("tx.note")} (${t("common.optional")})`} htmlFor="note">
        <textarea id="note" name="note" rows={2} maxLength={1000} defaultValue={transaction?.note ?? ""} className={inputClass} />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
    </form>
    {transaction ? (
      <ConfirmForm action={deleteAndClose} message={t("tx.deleteConfirm")} className="mt-3">
        <input type="hidden" name="id" value={transaction.id} />
        <button type="submit" className={buttonClass("danger", "w-full")}>
          {t("common.delete")}
        </button>
      </ConfirmForm>
    ) : null}
    </>
  );
}

export function TransactionSheet({
  open,
  onClose,
  ...props
}: Omit<TransactionFormProps, "onDone"> & { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={props.transaction ? t("tx.edit") : t("tx.add")}>
      <TransactionFormBody {...props} onDone={onClose} />
    </Sheet>
  );
}

export function AddTransactionButton({
  label,
  variant = "primary",
  ...props
}: Omit<TransactionFormProps, "onDone" | "transaction"> & { label: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass(variant)} onClick={() => setOpen(true)}>
        <Plus size={18} aria-hidden />
        {label}
      </button>
      <TransactionSheet {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
