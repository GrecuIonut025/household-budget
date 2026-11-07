"use client";

import { useActionState } from "react";
import { acceptInvite, createHousehold } from "@/app/actions/household";
import { SubmitButton } from "./submit-button";
import { Alert, Card, CardTitle, Field, inputClass } from "./ui";
import { useI18n } from "@/lib/i18n/provider";

const CURRENCIES = ["RON", "EUR", "USD", "GBP", "HUF", "MDL"];

export function CreateHouseholdForm() {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(createHousehold, {});
  return (
    <Card>
      <CardTitle>{t("onboarding.create")}</CardTitle>
      <form action={action} className="space-y-4">
        <Field label={t("onboarding.name")} htmlFor="name">
          <input id="name" name="name" required maxLength={120} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("onboarding.size")} htmlFor="size">
            <input id="size" name="size" type="number" min={1} max={50} defaultValue={1} inputMode="numeric" className={inputClass} />
          </Field>
          <Field label={t("onboarding.currency")} htmlFor="currency">
            <select id="currency" name="currency" defaultValue="RON" className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t("onboarding.language")} htmlFor="locale">
          <select id="locale" name="locale" defaultValue={locale} className={inputClass}>
            <option value="ro">Română</option>
            <option value="en">English</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("onboarding.monthlyLimit")} htmlFor="spendingLimit">
            <input id="spendingLimit" name="spendingLimit" inputMode="decimal" placeholder="0,00" className={inputClass} />
          </Field>
          <Field label={t("onboarding.groceryLimit")} htmlFor="groceryLimit">
            <input id="groceryLimit" name="groceryLimit" inputMode="decimal" placeholder="0,00" className={inputClass} />
          </Field>
        </div>
        <p className="text-xs text-muted">{t("onboarding.limitHint")}</p>
        {state.error ? <Alert>{state.error}</Alert> : null}
        <SubmitButton className="w-full">{t("common.create")}</SubmitButton>
      </form>
    </Card>
  );
}

export function JoinHouseholdForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(acceptInvite, {});
  return (
    <Card>
      <CardTitle>{t("onboarding.join")}</CardTitle>
      <form action={action} className="space-y-4">
        <Field label={t("onboarding.inviteCode")} hint={t("onboarding.joinHint")} htmlFor="token">
          <input id="token" name="token" required autoComplete="off" className={inputClass} />
        </Field>
        {state.error ? <Alert>{state.error}</Alert> : null}
        <SubmitButton variant="secondary" className="w-full">
          {t("onboarding.joinCta")}
        </SubmitButton>
      </form>
    </Card>
  );
}
