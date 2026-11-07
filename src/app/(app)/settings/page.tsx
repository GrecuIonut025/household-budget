import type { Metadata } from "next";
import Link from "next/link";
import {
  setLanguage,
  deleteHousehold,
  leaveHousehold,
  switchHousehold,
} from "@/app/actions/household";
import { ConfirmForm } from "@/components/confirm-form";
import { GoalsManager } from "@/components/settings/goals";
import { HouseholdForm } from "@/components/settings/household-form";
import { BudgetManager } from "@/components/settings/budget-manager";
import { InviteManager } from "@/components/settings/invites";
import { MemberList } from "@/components/settings/members";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardTitle,
  PageHeader,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { projectSavingsGoal } from "@/lib/budget-engine";
import {
  getBudgets,
  getPendingInvites,
  getSavingsGoals,
} from "@/lib/data/budget";
import { getMembers, requireAppContext } from "@/lib/data/context";
import { isAdmin } from "@/lib/data/types";
import { todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { toMinor } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.settings") };
}

export default async function SettingsPage() {
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const admin = isAdmin(role);
  const today = todayFor(household.timezone);

  const [members, budgets, goalData, invites] = await Promise.all([
    getMembers(household.id),
    getBudgets(household.id),
    getSavingsGoals(household.id),
    admin ? getPendingInvites(household.id) : Promise.resolve([]),
  ]);

  const goals = goalData.goals.map((goal) => ({
    goal,
    projection: projectSavingsGoal({
      target: toMinor(goal.target_amount),
      contributions: goalData.contributions
        .filter((c) => c.goal_id === goal.id)
        .map((c) => ({
          amount: toMinor(c.amount),
          contributedOn: c.contributed_on,
        })),
      targetDate: goal.target_date,
      today,
    }),
  }));

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={household.name} />
      <div className="grid gap-4">
        <Card id="household">
          <CardTitle>{t("settings.household")}</CardTitle>
          <HouseholdForm household={household} canEdit={admin} />
        </Card>

        <Card id="budget">
          <CardTitle>{t("settings.budget")}</CardTitle>
          <BudgetManager
            householdId={household.id}
            currency={household.currency}
            budgets={budgets}
            today={today}
            canEdit={admin}
          />
        </Card>

        <Card id="members">
          <CardTitle>{t("settings.members")}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t("settings.membersHint")}</p>
          <MemberList
            householdId={household.id}
            members={members}
            viewerRole={role}
            viewerId={ctx.user.id}
            locale={locale}
          />
        </Card>

        <Card id="invites">
          <CardTitle>{t("settings.invites")}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t("settings.invitesHint")}</p>
          <InviteManager
            householdId={household.id}
            role={role}
            invites={invites}
          />
        </Card>

        <Card id="goals">
          <CardTitle>{t("settings.goals")}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t("settings.goalsHint")}</p>
          <GoalsManager
            householdId={household.id}
            currency={household.currency}
            role={role}
            userId={ctx.user.id}
            members={members}
            goals={goals}
          />
        </Card>

        <Card id="preferences">
          <CardTitle>{t("settings.appearance")}</CardTitle>
          <p className="mb-3 text-sm text-muted">
            {t("settings.appearanceHint")}
          </p>
          <ThemeToggle />
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-1 text-sm font-medium">{t("settings.language")}</p>
            <p className="mb-3 text-sm text-muted">
              {t("settings.languageHint")}
            </p>
            <form action={setLanguage} className="flex gap-2">
              <select
                name="locale"
                defaultValue={locale}
                aria-label={t("settings.language")}
                className={inputClass}
              >
                <option value="ro">Română</option>
                <option value="en">English</option>
              </select>
              <button
                type="submit"
                className={buttonClass("secondary", "shrink-0")}
              >
                {t("common.save")}
              </button>
            </form>
          </div>
        </Card>

        <Card id="households">
          <CardTitle>{t("settings.switchHousehold")}</CardTitle>
          <ul className="mb-3 space-y-2">
            {ctx.memberships.map((m) => (
              <li
                key={m.household.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.household.name}
                  </p>
                  <p className="text-xs text-muted">{t(`role.${m.role}`)}</p>
                </div>
                {m.household.id === household.id ? null : (
                  <form action={switchHousehold}>
                    <input
                      type="hidden"
                      name="householdId"
                      value={m.household.id}
                    />
                    <button
                      type="submit"
                      className={buttonClass("secondary", "min-h-10 px-3")}
                    >
                      {t("settings.switchHousehold")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <Link href="/onboarding" className={buttonClass("secondary")}>
            {t("settings.newHousehold")}
          </Link>
        </Card>

        <Card id="danger" className="border-danger/30">
          <CardTitle>{t("settings.danger")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {role !== "owner" ? (
              <ConfirmForm
                action={leaveHousehold}
                message={t("settings.leaveConfirm")}
              >
                <input type="hidden" name="householdId" value={household.id} />
                <button type="submit" className={buttonClass("danger")}>
                  {t("settings.leave")}
                </button>
              </ConfirmForm>
            ) : (
              <ConfirmForm
                action={deleteHousehold}
                message={t("settings.deleteHouseholdConfirm")}
              >
                <input type="hidden" name="householdId" value={household.id} />
                <button type="submit" className={buttonClass("danger")}>
                  {t("settings.deleteHousehold")}
                </button>
              </ConfirmForm>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
