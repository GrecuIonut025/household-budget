"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/household";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";
import { useI18n } from "@/lib/i18n/provider";

export function InviteAcceptForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(acceptInvite, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full">{t("invite.accept")}</SubmitButton>
    </form>
  );
}
