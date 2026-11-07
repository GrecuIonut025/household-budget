"use client";

import { useActionState } from "react";
import { updateHousehold } from "@/app/actions/household";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, inputClass } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { moneyInputValue } from "@/lib/money";
import type { Household } from "@/lib/data/types";

export function HouseholdForm({ household, canEdit }: { household: Household; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(updateHousehold, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="householdId" value={household.id} />
      <fieldset disabled={!canEdit} className="space-y-4">
        <Field label={t("settings.householdName")} htmlFor="hh-name">
          <input id="hh-name" name="name" required maxLength={120} defaultValue={household.name} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("settings.householdSize")} htmlFor="hh-size">
            <input id="hh-size" name="size" type="number" min={1} max={50} defaultValue={household.household_size} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label={t("settings.currency")} htmlFor="hh-currency">
            <input id="hh-currency" value={household.currency} readOnly disabled className={inputClass} />
          </Field>
        </div>
        <Field label={t("settings.openingBalance")} hint={t("settings.openingBalanceHint")} htmlFor="hh-opening">
          <input id="hh-opening" name="openingBalance" inputMode="decimal" defaultValue={moneyInputValue(household.opening_balance, locale)} className={inputClass} />
        </Field>
      </fieldset>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.message ? <Alert tone="ok">{state.message}</Alert> : null}
      {canEdit ? <SubmitButton>{t("common.save")}</SubmitButton> : <p className="text-xs text-muted">{t("settings.adminOnly")}</p>}
    </form>
  );
}
