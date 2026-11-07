"use client";

import { Repeat } from "lucide-react";
import { useActionState } from "react";
import { createRecurringList } from "@/app/actions/products";
import { useI18n } from "@/lib/i18n/provider";
import { SubmitButton } from "../submit-button";
import { Alert } from "../ui";

export function RecurringListButton({ householdId }: { householdId: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(createRecurringList, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <SubmitButton variant="secondary" className="w-full sm:w-auto">
        <Repeat size={18} aria-hidden />
        {t("products.recurringCreate")}
      </SubmitButton>
      <p className="text-xs text-muted">{t("products.recurringHint")}</p>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}
    </form>
  );
}
