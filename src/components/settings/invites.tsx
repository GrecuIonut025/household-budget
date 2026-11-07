"use client";

import { useActionState } from "react";
import { createInvite, revokeInvite } from "@/app/actions/household";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { isAdmin, type HouseholdRole, type InviteRow } from "@/lib/data/types";

export function InviteManager({ householdId, role, invites }: { householdId: string; role: HouseholdRole; invites: InviteRow[] }) {
  const { t, locale } = useI18n();
  const [state, action] = useActionState(createInvite, {});
  if (!isAdmin(role)) return <p className="text-sm text-muted">{t("settings.adminOnly")}</p>;
  const roles = role === "owner" ? (["member", "viewer", "admin"] as const) : (["member", "viewer"] as const);

  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <input type="hidden" name="householdId" value={householdId} />
        <Field label={t("settings.inviteEmail")} htmlFor="inv-email">
          <input id="inv-email" name="email" type="email" autoComplete="off" className={inputClass} />
        </Field>
        <Field label={t("settings.inviteRole")} htmlFor="inv-role">
          <select id="inv-role" name="role" defaultValue="member" className={inputClass}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <SubmitButton>{t("settings.inviteCreate")}</SubmitButton>
      </form>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.secret ? (
        <div className="space-y-2 rounded-xl border border-brand/40 bg-brand-soft p-3">
          <p className="text-xs font-medium text-brand-strong">{t("settings.inviteLink")}</p>
          <p className="break-all font-mono text-xs">{state.secret}</p>
          <CopyButton value={state.secret} />
        </div>
      ) : null}
      {invites.length === 0 ? (
        <p className="text-sm text-muted">{t("settings.inviteEmpty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{inv.email ?? t("settings.inviteAnyone")}</p>
                <p className="text-xs text-muted">
                  {t(`role.${inv.role}`)} · {t("settings.inviteExpires", { date: formatDate(inv.expires_at.slice(0, 10), locale) })}
                </p>
              </div>
              <form action={revokeInvite}>
                <input type="hidden" name="id" value={inv.id} />
                <button type="submit" className={buttonClass("danger", "min-h-10 px-3")}>
                  {t("settings.inviteRevoke")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
