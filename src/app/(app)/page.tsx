import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PiggyBank, Receipt, ShoppingBasket, Target, Users, Wallet } from "lucide-react";
import { AddTransactionButton } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Stat, buttonClass } from "@/components/ui";
import {
  computeBudgetSummary,
  projectSavingsGoal,
  spendingByMember,
  type EngineContribution,
} from "@/lib/budget-engine";
import {
  getActiveReservations,
  getCategories,
  getCurrentBudget,
  getHouseholdBalance,
  getRecentTransactions,
  getSavingsGoals,
  getTransactionsBetween,
  toEngineReservations,
  toEngineTransactions,
} from "@/lib/data/budget";
import { getMembers, requireAppContext } from "@/lib/data/context";
import { canWrite, isAdmin } from "@/lib/data/types";
import { formatDate, todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.dashboard") };
}

export default async function DashboardPage() {
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const today = todayFor(household.timezone);
  const money = (minor: number) => formatMoney(minor, household.currency, locale);

  const [budget, categories, members, balance, recent, goalData] = await Promise.all([
    getCurrentBudget(household.id, today),
    getCategories(household.id),
    getMembers(household.id),
    getHouseholdBalance(household.id),
    getRecentTransactions(household.id, 5),
    getSavingsGoals(household.id),
  ]);

  const periodTransactions = budget ? await getTransactionsBetween(household.id, budget.start_date, budget.end_date) : [];
  const reservations = budget ? await getActiveReservations(budget.id) : [];
  const engineTransactions = toEngineTransactions(periodTransactions, categories);

  const summary = budget
    ? computeBudgetSummary({
        budget: {
          startDate: budget.start_date,
          endDate: budget.end_date,
          spendingLimit: budget.spending_limit === null ? null : toMinor(budget.spending_limit),
          groceryLimit: budget.grocery_limit === null ? null : toMinor(budget.grocery_limit),
        },
        transactions: engineTransactions,
        reservations: toEngineReservations(reservations),
        today,
      })
    : null;

  const memberSpending = budget
    ? spendingByMember(engineTransactions, { from: budget.start_date, to: budget.end_date }).filter((r) => r.expenses > 0)
    : [];
  const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? t("common.unattributed");
  const memberTotal = memberSpending.reduce((s, r) => s + r.expenses, 0);

  const writer = canWrite(role);
  const admin = isAdmin(role);
  const formProps = {
    householdId: household.id,
    categories,
    members,
    currentUserId: ctx.user.id,
    today,
  };

  const goals = goalData.goals.filter((g) => g.status !== "archived").map((goal) => {
    const contributions: EngineContribution[] = goalData.contributions
      .filter((c) => c.goal_id === goal.id)
      .map((c) => ({ amount: toMinor(c.amount), contributedOn: c.contributed_on, userId: c.user_id }));
    return { goal, projection: projectSavingsGoal({ target: toMinor(goal.target_amount), contributions, targetDate: goal.target_date, today }) };
  });

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: ctx.displayName })}
        subtitle={budget ? `${budget.name} · ${t("dashboard.period", { start: formatDate(budget.start_date, locale), end: formatDate(budget.end_date, locale) })}` : undefined}
        action={writer ? <AddTransactionButton label={t("dashboard.addTransaction")} {...formProps} /> : undefined}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <div className="grid gap-5 sm:grid-cols-3">
            <Stat
              label={t("dashboard.available")}
              value={money(balance.available)}
              hint={t("dashboard.availableHint")}
              tone={balance.available < 0 ? "danger" : "default"}
            />
            <Stat label={t("dashboard.monthIncome")} value={money(summary?.income ?? 0)} tone="ok" />
            <Stat label={t("dashboard.monthExpenses")} value={money(summary?.expenses ?? 0)} />
          </div>
        </Card>

        {summary === null ? (
          <Card className="md:col-span-2">
            <EmptyState
              icon={<Wallet size={28} aria-hidden />}
              title={t("dashboard.noBudgetTitle")}
              body={t("dashboard.noBudgetBody")}
              action={
                admin ? (
                  <Link href="/settings#budget" className={buttonClass("secondary")}>
                    {t("settings.budgetCreate")}
                  </Link>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            <Card>
              <CardTitle>{t("dashboard.dailyAllowance")}</CardTitle>
              {summary.dailyAllowance === null || summary.todayRemaining === null ? (
                <EmptyState
                  icon={<Target size={24} aria-hidden />}
                  title={t("dashboard.noLimitTitle")}
                  body={t("dashboard.noLimitBody")}
                  action={
                    admin ? (
                      <Link href="/settings#budget" className={buttonClass("secondary")}>
                        {t("dashboard.setLimit")}
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <Stat
                    label={t("common.today")}
                    value={money(summary.dailyAllowance)}
                    hint={t("dashboard.allowanceHint", { amount: money(summary.remaining ?? 0), days: t("common.days", { count: summary.daysLeft }) })}
                  />
                  <p className={`mt-3 text-sm font-medium ${summary.todayRemaining < 0 ? "text-danger" : "text-ok"}`}>
                    {summary.todayRemaining < 0
                      ? t("dashboard.todayOver", { amount: money(-summary.todayRemaining) })
                      : t("dashboard.todayLeft", { amount: money(summary.todayRemaining) })}
                  </p>
                </>
              )}
            </Card>

            <Card>
              <CardTitle>{t("dashboard.budgetRemaining")}</CardTitle>
              {summary.spendingLimit === null || summary.remaining === null ? (
                <p className="text-sm text-muted">{t("dashboard.noLimitBody")}</p>
              ) : (
                <div className="space-y-3">
                  <Stat
                    label={t("dashboard.of", { total: money(summary.spendingLimit) })}
                    value={money(Math.max(summary.remaining, 0))}
                    tone={summary.remaining < 0 ? "danger" : "default"}
                    hint={summary.remaining < 0 ? t("dashboard.overBudget", { amount: money(-summary.remaining) }) : undefined}
                  />
                  <ProgressBar value={summary.committed} max={summary.spendingLimit} />
                </div>
              )}
            </Card>

            <Card>
              <CardTitle action={<ShoppingBasket size={18} className="text-muted" aria-hidden />}>{t("dashboard.grocery")}</CardTitle>
              <div className="space-y-3">
                <Stat
                  label={
                    summary.groceryLimit === null
                      ? t("dashboard.groceryNoLimit")
                      : t("dashboard.groceryLimit", { spent: money(summary.groceryExpenses), limit: money(summary.groceryLimit) })
                  }
                  value={money(summary.groceryExpenses)}
                  hint={
                    summary.groceryRemaining !== null
                      ? t("dashboard.groceryRemaining", { amount: money(summary.groceryRemaining) })
                      : undefined
                  }
                  tone={summary.groceryRemaining !== null && summary.groceryRemaining < 0 ? "danger" : "default"}
                />
                {summary.groceryLimit !== null ? (
                  <ProgressBar value={summary.groceryExpenses + summary.reservedGrocery} max={summary.groceryLimit} />
                ) : null}
                {summary.reservedGrocery > 0 ? (
                  <p className="text-xs text-muted">{t("dashboard.groceryReserved", { amount: money(summary.reservedGrocery) })}</p>
                ) : null}
              </div>
            </Card>

            <Card>
              <CardTitle>{t("dashboard.reserved")}</CardTitle>
              {summary.reservedTotal > 0 ? (
                <Stat label={t("dashboard.reservedHint")} value={money(summary.reservedTotal)} />
              ) : (
                <p className="text-sm text-muted">{t("dashboard.reservedEmpty")}</p>
              )}
            </Card>
          </>
        )}

        <Card>
          <CardTitle action={<PiggyBank size={18} className="text-muted" aria-hidden />}>{t("dashboard.savings")}</CardTitle>
          {goals.length === 0 ? (
            <EmptyState
              title={t("dashboard.savingsEmptyTitle")}
              body={t("dashboard.savingsEmptyBody")}
              action={
                writer ? (
                  <Link href="/settings#goals" className={buttonClass("secondary")}>
                    {t("settings.goalCreate")}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-4">
              {goals.map(({ goal, projection }) => (
                <li key={goal.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{goal.name}</p>
                    <Badge tone={projection.status === "completed" || projection.status === "on_track" ? "ok" : projection.status === "behind" || projection.status === "stalled" ? "warn" : "default"}>
                      {t(`savings.status.${projection.status}`)}
                    </Badge>
                  </div>
                  <ProgressBar value={projection.current} max={projection.target} tone="brand" />
                  <p className="tabular text-xs text-muted">
                    {t("dashboard.savingsProgress", { current: money(projection.current), target: money(projection.target) })}
                    {goal.scope === "individual" ? ` · ${nameOf(goal.owner_id)}` : ` · ${t("common.shared")}`}
                  </p>
                  {projection.projectedCompletion ? (
                    <p className="text-xs text-muted">{t("savings.projected", { date: formatDate(projection.projectedCompletion, locale, { month: "short", year: "numeric" }) })}</p>
                  ) : null}
                  {projection.requiredMonthly !== null && projection.status !== "completed" ? (
                    <p className="text-xs text-muted">{t("savings.needed", { amount: money(projection.requiredMonthly) })}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {summary ? (
          <Card>
            <CardTitle action={<Users size={18} className="text-muted" aria-hidden />}>{t("dashboard.byMember")}</CardTitle>
            {memberSpending.length === 0 ? (
              <p className="text-sm text-muted">{t("dashboard.byMemberEmpty")}</p>
            ) : (
              <ul className="space-y-3">
                {memberSpending
                  .sort((a, b) => b.expenses - a.expenses)
                  .map((row) => (
                    <li key={row.userId ?? "none"} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{nameOf(row.userId)}</p>
                        <p className="tabular text-sm font-semibold">{money(row.expenses)}</p>
                      </div>
                      <ProgressBar value={row.expenses} max={memberTotal} tone="brand" />
                      <p className="text-xs text-muted">
                        {t("dashboard.sharedVsIndividual", { shared: money(row.sharedExpenses), individual: money(row.individualExpenses) })}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        ) : null}

        <Card className="md:col-span-2">
          <CardTitle
            action={
              <Link href="/transactions" className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong">
                {t("dashboard.viewAll")} <ArrowRight size={14} aria-hidden />
              </Link>
            }
          >
            {t("dashboard.recent")}
          </CardTitle>
          {recent.length === 0 ? (
            <EmptyState
              icon={<Receipt size={28} aria-hidden />}
              title={t("dashboard.recentEmptyTitle")}
              body={t("dashboard.recentEmptyBody")}
              action={writer ? <AddTransactionButton label={t("dashboard.addTransaction")} {...formProps} /> : undefined}
            />
          ) : (
            <TransactionList
              householdId={household.id}
              currency={household.currency}
              categories={categories}
              members={members}
              currentUserId={ctx.user.id}
              today={today}
              grouped={false}
              transactions={recent.map((tx) => ({ ...tx, editable: admin || (writer && tx.created_by === ctx.user.id) }))}
            />
          )}
        </Card>
      </div>
    </>
  );
}
