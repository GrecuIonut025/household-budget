import { changeMemberRole, removeMember, transferOwnership } from "@/app/actions/household";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge, buttonClass, inputClass } from "@/components/ui";
import { createTranslator, type Locale } from "@/lib/i18n";
import { isAdmin, type HouseholdRole, type MemberRow } from "@/lib/data/types";

export function MemberList({
  householdId,
  members,
  viewerRole,
  viewerId,
  locale,
}: {
  householdId: string;
  members: MemberRow[];
  viewerRole: HouseholdRole;
  viewerId: string;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const viewerIsOwner = viewerRole === "owner";

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {members.map((m) => {
        const isSelf = m.user_id === viewerId;
        const roleLocked = m.role === "owner" || !isAdmin(viewerRole) || (m.role === "admin" && !viewerIsOwner);
        const options = viewerIsOwner ? (["admin", "member", "viewer"] as const) : (["member", "viewer"] as const);
        const canRemove = !isSelf && m.role !== "owner" && isAdmin(viewerRole) && (m.role !== "admin" || viewerIsOwner);
        return (
          <li key={m.user_id} className="space-y-3 px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong" aria-hidden>
                {m.display_name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.display_name}
                  {isSelf ? <span className="text-muted"> ({t("common.you")})</span> : null}
                </p>
                <p className="text-xs text-muted">{t(`role.${m.role}.hint`)}</p>
              </div>
              <Badge tone={m.role === "owner" ? "brand" : "default"}>{t(`role.${m.role}`)}</Badge>
            </div>
            {!roleLocked || canRemove || (viewerIsOwner && !isSelf) ? (
              <div className="flex flex-wrap items-center gap-2 pl-13">
                {!roleLocked ? (
                  <form action={changeMemberRole} className="flex items-center gap-2">
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="userId" value={m.user_id} />
                    <select name="role" defaultValue={m.role} aria-label={t("settings.changeRole")} className={`${inputClass} min-h-10 w-auto py-1.5`}>
                      {options.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}`)}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={buttonClass("secondary", "min-h-10 px-3")}>
                      {t("common.save")}
                    </button>
                  </form>
                ) : null}
                {viewerIsOwner && !isSelf ? (
                  <ConfirmForm action={transferOwnership} message={t("settings.transferConfirm")}>
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="userId" value={m.user_id} />
                    <button type="submit" className={buttonClass("ghost", "min-h-10 px-3")}>
                      {t("settings.transferOwnership")}
                    </button>
                  </ConfirmForm>
                ) : null}
                {canRemove ? (
                  <ConfirmForm action={removeMember} message={t("settings.removeMemberConfirm")}>
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="userId" value={m.user_id} />
                    <button type="submit" className={buttonClass("danger", "min-h-10 px-3")}>
                      {t("settings.removeMember")}
                    </button>
                  </ConfirmForm>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
