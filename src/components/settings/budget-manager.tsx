"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { saveBudget } from "@/app/actions/household";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Badge, Field, buttonClass, inputClass } from "@/components/ui";
import { addDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney, moneyInputValue, toMinor } from "@/lib/money";
import type { BudgetRow } from "@/lib/data/types";

function BudgetForm({ householdId, budget, defaults, onDone }: { householdId: string; budget: BudgetRow | null; defaults: { start: string; end: string; name: string }; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(saveBudget, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      {budget ? <input type="hidden" name="id" value={budget.id} /> : null}
      <Field label={t("settings.budgetName")} htmlFor="b-name">
        <input id="b-name" name="name" required maxLength={120} defaultValue={budget?.name ?? defaults.name} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("settings.budgetStart")} htmlFor="b-start">
          <input id="b-start" name="startDate" type="date" required defaultValue={budget?.start_date ?? defaults.start} className={inputClass} />
        </Field>
        <Field label={t("settings.budgetEnd")} htmlFor="b-end">
          <input id="b-end" name="endDate" type="date" required defaultValue={budget?.end_date ?? defaults.end} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("settings.spendingLimit")} htmlFor="b-limit">
          <input id="b-limit" name="spendingLimit" inputMode="decimal" placeholder="0,00" defaultValue={moneyInputValue(budget?.spending_limit, locale)} className={inputClass} />
        </Field>
        <Field label={t("settings.groceryLimit")} htmlFor="b-grocery">
          <input id="b-grocery" name="groceryLimit" inputMode="decimal" placeholder="0,00" defaultValue={moneyInputValue(budget?.grocery_limit, locale)} className={inputClass} />
        </Field>
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
    </form>
  );
}

export function BudgetManager({
  householdId,
  currency,
  budgets,
  today,
  canEdit,
}: {
  householdId: string;
  currency: string;
  budgets: BudgetRow[];
  today: string;
  canEdit: boolean;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<BudgetRow | "new" | null>(null);
  const latestEnd = budgets.reduce((max, b) => (b.end_date > max ? b.end_date : max), "");
  const start = latestEnd && latestEnd >= today ? addDays(latestEnd, 1) : `${today.slice(0, 7)}-01`;
  const [y, m] = start.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const defaults = { start, end: end > start ? end : addDays(start, 29), name: "" };
  const money = (n: number) => formatMoney(toMinor(n), currency, locale);

  return (
    <div className="space-y-3">
      {budgets.length === 0 ? <p className="text-sm text-muted">{t("settings.budgetNone")}</p> : null}
      <ul className="space-y-2">
        {budgets.map((b) => {
          const current = b.is_active && b.start_date <= today && b.end_date >= today;
          return (
            <li key={b.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {b.name}
                  {current ? <Badge tone="brand">{t("common.today")}</Badge> : null}
                </p>
                <p className="tabular text-xs text-muted">
                  {formatDate(b.start_date, locale, { day: "numeric", month: "short", year: "numeric" })} – {formatDate(b.end_date, locale, { day: "numeric", month: "short", year: "numeric" })}
                  {b.spending_limit !== null ? ` · ${money(b.spending_limit)}` : ""}
                </p>
              </div>
              {canEdit ? (
                <button type="button" onClick={() => setEditing(b)} className={buttonClass("ghost", "size-11 p-0")} aria-label={t("common.edit")}>
                  <Pencil size={18} aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canEdit ? (
        <button type="button" onClick={() => setEditing("new")} className={buttonClass("secondary")}>
          <Plus size={18} aria-hidden />
          {t("settings.budgetNew")}
        </button>
      ) : (
        <p className="text-xs text-muted">{t("settings.adminOnly")}</p>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" || editing === null ? t("settings.budgetNew") : t("common.edit")}>
        <BudgetForm householdId={householdId} budget={editing === "new" ? null : editing} defaults={defaults} onDone={() => setEditing(null)} />
      </Sheet>
    </div>
  );
}
