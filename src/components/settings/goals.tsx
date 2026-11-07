"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { contributeToGoal, createGoal, deleteGoal } from "@/app/actions/household";
import { ConfirmForm } from "@/components/confirm-form";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Badge, Field, ProgressBar, buttonClass, inputClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/money";
import type { SavingsProjection } from "@/lib/budget-engine";
import { canWrite, isAdmin, type HouseholdRole, type MemberRow, type SavingsGoalRow } from "@/lib/data/types";

export interface GoalView {
  goal: SavingsGoalRow;
  projection: SavingsProjection;
}

function ContributeForm({ householdId, goalId, userId }: { householdId: string; goalId: string; userId: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(contributeToGoal, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <input name="amount" required inputMode="decimal" placeholder="0,00" aria-label={t("settings.contributionAmount")} className={`${inputClass} min-h-10 py-1.5`} />
        <button type="submit" name="direction" value="add" className={buttonClass("secondary", "min-h-10 shrink-0 px-3")}>
          {t("settings.contribute")}
        </button>
        <button type="submit" name="direction" value="withdraw" className={buttonClass("ghost", "min-h-10 shrink-0 px-3")}>
          {t("settings.withdraw")}
        </button>
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
    </form>
  );
}

function CreateGoalForm({ householdId, userId, onDone }: { householdId: string; userId: string; onDone: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(
    async (prev: Awaited<ReturnType<typeof createGoal>>, formData: FormData) => {
      const result = await createGoal(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    {},
  );
  const [scope, setScope] = useState<"shared" | "individual">("shared");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="ownerId" value={scope === "individual" ? userId : ""} />
      <Field label={t("settings.goalName")} htmlFor="g-name">
        <input id="g-name" name="name" required maxLength={120} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("settings.goalTarget")} htmlFor="g-target">
          <input id="g-target" name="targetAmount" required inputMode="decimal" placeholder="0,00" className={inputClass} />
        </Field>
        <Field label={`${t("settings.goalDate")} (${t("common.optional")})`} htmlFor="g-date">
          <input id="g-date" name="targetDate" type="date" className={inputClass} />
        </Field>
      </div>
      <Field label={t("settings.goalScope")} htmlFor="g-scope">
        <select id="g-scope" name="scope" value={scope} onChange={(e) => setScope(e.target.value as "shared" | "individual")} className={inputClass}>
          <option value="shared">{t("common.shared")}</option>
          <option value="individual">{t("common.individual")}</option>
        </select>
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <SubmitButton className="w-full">{t("settings.goalCreate")}</SubmitButton>
    </form>
  );
}

export function GoalsManager({
  householdId,
  currency,
  role,
  userId,
  members,
  goals,
}: {
  householdId: string;
  currency: string;
  role: HouseholdRole;
  userId: string;
  members: MemberRow[];
  goals: GoalView[];
}) {
  const { t, locale } = useI18n();
  const [creating, setCreating] = useState(false);
  const money = (n: number) => formatMoney(n, currency, locale);
  const writer = canWrite(role);
  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "—";

  return (
    <div className="space-y-3">
      {goals.length === 0 ? <p className="text-sm text-muted">{t("settings.goalsEmpty")}</p> : null}
      <ul className="space-y-3">
        {goals.map(({ goal, projection }) => {
          const manage = isAdmin(role) || (writer && (goal.scope === "shared" || goal.owner_id === userId));
          return (
            <li key={goal.id} className="space-y-3 rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{goal.name}</p>
                  <p className="text-xs text-muted">
                    {goal.scope === "shared" ? t("common.shared") : `${t("common.individual")} · ${nameOf(goal.owner_id)}`}
                    {goal.target_date ? ` · ${formatDate(goal.target_date, locale, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </p>
                </div>
                <Badge tone={projection.status === "completed" || projection.status === "on_track" ? "ok" : projection.status === "behind" || projection.status === "stalled" ? "warn" : "default"}>
                  {t(`savings.status.${projection.status}`)}
                </Badge>
              </div>
              <ProgressBar value={projection.current} max={projection.target} tone="brand" />
              <p className="tabular text-xs text-muted">{t("dashboard.savingsProgress", { current: money(projection.current), target: money(projection.target) })}</p>
              {writer ? <ContributeForm householdId={householdId} goalId={goal.id} userId={userId} /> : null}
              {manage ? (
                <ConfirmForm action={deleteGoal} message={t("settings.goalDeleteConfirm")}>
                  <input type="hidden" name="id" value={goal.id} />
                  <button type="submit" className="text-xs font-medium text-danger">
                    {t("settings.goalDelete")}
                  </button>
                </ConfirmForm>
              ) : null}
            </li>
          );
        })}
      </ul>
      {writer ? (
        <>
          <button type="button" onClick={() => setCreating(true)} className={buttonClass("secondary")}>
            <Plus size={18} aria-hidden />
            {t("settings.goalCreate")}
          </button>
          <Sheet open={creating} onClose={() => setCreating(false)} title={t("settings.goalCreate")}>
            <CreateGoalForm householdId={householdId} userId={userId} onDone={() => setCreating(false)} />
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
