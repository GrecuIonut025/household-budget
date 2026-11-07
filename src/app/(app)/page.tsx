import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AddTransactionButton } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  ProgressBar,
  Section,
  Stat,
  buttonClass,
} from "@/components/ui";
import {
  computeBudgetSummary,
  computeTomorrowAllowance,
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
import { getShoppingListPreviews } from "@/lib/data/shopping-lists";
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
  const money = (minor: number) =>
    formatMoney(minor, household.currency, locale);

  const [
    budget,
    categories,
    members,
    balance,
    recent,
    goalData,
    plannedLists,
  ] = await Promise.all([
    getCurrentBudget(household.id, today),
    getCategories(household.id),
    getMembers(household.id),
    getHouseholdBalance(household.id),
    getRecentTransactions(household.id, 5),
    getSavingsGoals(household.id),
    getShoppingListPreviews(household.id),
  ]);

  const periodTransactions = budget
    ? await getTransactionsBetween(
        household.id,
        budget.start_date,
        budget.end_date,
      )
    : [];
  const reservations = budget ? await getActiveReservations(budget.id) : [];
  const engineTransactions = toEngineTransactions(
    periodTransactions,
    categories,
  );

  const summary = budget
    ? computeBudgetSummary({
        budget: {
          startDate: budget.start_date,
          endDate: budget.end_date,
          spendingLimit:
            budget.spending_limit === null
              ? null
              : toMinor(budget.spending_limit),
          groceryLimit:
            budget.grocery_limit === null
              ? null
              : toMinor(budget.grocery_limit),
        },
        transactions: engineTransactions,
        reservations: toEngineReservations(reservations),
        today,
      })
    : null;

  const tomorrow = summary
    ? computeTomorrowAllowance({
        spendingLimit: summary.spendingLimit,
        todayIncome: summary.todayIncome,
        expenses: summary.expenses,
        reservedTotal: summary.reservedTotal,
        daysLeft: summary.daysLeft,
        dailyAllowance: summary.dailyAllowance,
      })
    : null;

  const memberSpending = budget
    ? spendingByMember(engineTransactions, {
        from: budget.start_date,
        to: budget.end_date,
      }).filter((r) => r.expenses > 0)
    : [];
  const nameOf = (id: string | null) =>
    members.find((m) => m.user_id === id)?.display_name ??
    t("common.unattributed");
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

  const goals = goalData.goals
    .filter((g) => g.status !== "archived")
    .map((goal) => {
      const contributions: EngineContribution[] = goalData.contributions
        .filter((c) => c.goal_id === goal.id)
        .map((c) => ({
          amount: toMinor(c.amount),
          contributedOn: c.contributed_on,
          userId: c.user_id,
        }));
      return {
        goal,
        projection: projectSavingsGoal({
          target: toMinor(goal.target_amount),
          contributions,
          targetDate: goal.target_date,
          today,
        }),
      };
    });

  const plannedTotalMinor = plannedLists.reduce((sum, list) => {
    if (list.planned_budget !== null) return sum + toMinor(list.planned_budget);
    if (list.estimated_total !== null)
      return sum + toMinor(list.estimated_total);
    return sum;
  }, 0);

  const todayTone =
    summary?.todayRemaining === null || summary?.todayRemaining === undefined
      ? "default"
      : summary.todayRemaining < 0
        ? summary.todayRemaining < -(summary.dailyAllowance ?? 0) * 0.25
          ? "danger"
          : "warn"
        : "default";

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", { name: ctx.displayName })}
        subtitle={
          budget
            ? `${household.name} · ${t("dashboard.period", {
                start: formatDate(budget.start_date, locale),
                end: formatDate(budget.end_date, locale),
              })}`
            : household.name
        }
        action={
          writer ? (
            <AddTransactionButton
              label={t("dashboard.addTransaction")}
              {...formProps}
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-8">
        {/* Financial overview — available is primary */}
        <Section>
          <Card className="!p-5 sm:!p-6">
            <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end">
              <Stat
                label={t("dashboard.available")}
                value={money(balance.available)}
                hint={t("dashboard.availableHint")}
                tone={balance.available < 0 ? "danger" : "default"}
                size="lg"
              />
              <Stat
                label={t("dashboard.monthExpenses")}
                value={money(summary?.expenses ?? 0)}
                size="md"
              />
              <Stat
                label={t("dashboard.safeDaily")}
                value={
                  summary?.dailyAllowance === null ||
                  summary?.dailyAllowance === undefined
                    ? "—"
                    : money(summary.dailyAllowance)
                }
                size="md"
              />
            </div>
          </Card>
        </Section>

        {summary === null ? (
          <Card>
            <EmptyState
              title={t("dashboard.noBudgetTitle")}
              body={t("dashboard.noBudgetBody")}
              action={
                admin ? (
                  <Link
                    href="/settings#budget"
                    className={buttonClass("secondary")}
                  >
                    {t("settings.budgetCreate")}
                  </Link>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            {/* Spending pace */}
            <Section title={t("dashboard.spendingPace")}>
              <Card>
                {summary.dailyAllowance === null ||
                summary.todayRemaining === null ? (
                  <EmptyState
                    title={t("dashboard.noLimitTitle")}
                    body={t("dashboard.noLimitBody")}
                    action={
                      admin ? (
                        <Link
                          href="/settings#budget"
                          className={buttonClass("secondary")}
                        >
                          {t("dashboard.setLimit")}
                        </Link>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Stat
                        label={t("common.today")}
                        value={money(summary.dailyAllowance)}
                        hint={t("dashboard.allowanceHint", {
                          // Morning pool: remaining still includes today's spend, so add it back.
                          amount: money(
                            Math.max((summary.remaining ?? 0) + summary.todaySpent, 0),
                          ),
                          days: t("common.days", { count: summary.daysLeft }),
                        })}
                      />
                      <p className="mt-3 text-sm text-muted">
                        {t("dashboard.todaySpent", { amount: money(summary.todaySpent) })}
                      </p>
                      <p
                        className={`mt-1 text-sm ${
                          todayTone === "danger"
                            ? "text-danger"
                            : todayTone === "warn"
                              ? "text-warn"
                              : "text-muted"
                        }`}
                      >
                        {summary.todayRemaining < 0
                          ? t("dashboard.todayOver", {
                              amount: money(-summary.todayRemaining),
                            })
                          : summary.todayRemaining === 0
                            ? t("dashboard.todayOnPace")
                            : t("dashboard.todayLeft", {
                                amount: money(summary.todayRemaining),
                              })}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t("dashboard.daysLeft", {
                          days: t("common.days", { count: summary.daysLeft }),
                        })}
                      </p>
                      {summary.reservedTotal > 0 ? (
                        <p className="mt-2 text-xs text-muted">
                          {t("dashboard.allowanceReserved", {
                            amount: money(summary.reservedTotal),
                          })}
                        </p>
                      ) : null}
                    </div>

                    <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      {tomorrow?.tomorrowAllowance !== null &&
                      tomorrow?.tomorrowAllowance !== undefined ? (
                        <>
                          <Stat
                            label={t("dashboard.tomorrowAllowance")}
                            value={money(tomorrow.tomorrowAllowance)}
                            tone={tomorrow.overBudget ? "danger" : "default"}
                          />
                          {tomorrow.overBudget ? (
                            <p className="mt-2 text-sm text-danger">
                              {t("dashboard.tomorrowOverBudget")}
                            </p>
                          ) : tomorrow.allowanceDelta !== null ? (
                            <p className="mt-2 text-sm text-muted">
                              {tomorrow.allowanceDelta > 0
                                ? t("dashboard.allowanceDeltaUp", {
                                    amount: money(tomorrow.allowanceDelta),
                                  })
                                : tomorrow.allowanceDelta < 0
                                  ? t("dashboard.allowanceDeltaDown", {
                                      amount: money(-tomorrow.allowanceDelta),
                                    })
                                  : t("dashboard.allowanceDeltaSame")}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-muted">
                          {t("dashboard.daysLeft", {
                            days: t("common.days", { count: 1 }),
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </Section>

            {/* Budget progress */}
            <Section title={t("dashboard.budgetProgress")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardTitle>{t("dashboard.budgetRemaining")}</CardTitle>
                  {summary.spendingLimit === null ||
                  summary.remaining === null ? (
                    <p className="text-sm text-muted">
                      {t("dashboard.noLimitBody")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <Stat
                        label={t("dashboard.of", {
                          total: money(summary.spendingLimit),
                        })}
                        value={money(Math.max(summary.remaining, 0))}
                        tone={summary.remaining < 0 ? "danger" : "default"}
                        hint={
                          summary.remaining < 0
                            ? t("dashboard.overBudget", {
                                amount: money(-summary.remaining),
                              })
                            : undefined
                        }
                      />
                      <ProgressBar
                        value={summary.committed}
                        max={summary.spendingLimit}
                      />
                    </div>
                  )}
                </Card>

                <Card>
                  <CardTitle>{t("dashboard.grocery")}</CardTitle>
                  <div className="space-y-3">
                    <Stat
                      label={
                        summary.groceryLimit === null
                          ? t("dashboard.groceryNoLimit")
                          : t("dashboard.groceryLimit", {
                              spent: money(summary.groceryExpenses),
                              limit: money(summary.groceryLimit),
                            })
                      }
                      value={money(summary.groceryExpenses)}
                      hint={
                        summary.groceryRemaining !== null
                          ? t("dashboard.groceryRemaining", {
                              amount: money(summary.groceryRemaining),
                            })
                          : undefined
                      }
                      tone={
                        summary.groceryRemaining !== null &&
                        summary.groceryRemaining < 0
                          ? "danger"
                          : "default"
                      }
                    />
                    {summary.groceryLimit !== null ? (
                      <ProgressBar
                        value={
                          summary.groceryExpenses + summary.reservedGrocery
                        }
                        max={summary.groceryLimit}
                      />
                    ) : null}
                    {summary.reservedGrocery > 0 ? (
                      <p className="text-xs text-muted">
                        {t("dashboard.groceryReserved", {
                          amount: money(summary.reservedGrocery),
                        })}
                      </p>
                    ) : null}
                  </div>
                </Card>
              </div>
            </Section>
          </>
        )}

        {/* Upcoming purchases — planned vs reserved */}
        <Section
          title={t("dashboard.upcoming")}
          action={
            <Link
              href="/shopping-lists"
              className="text-sm font-medium text-brand-strong hover:underline"
            >
              {t("dashboard.viewAll")}
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardTitle>{t("dashboard.planned")}</CardTitle>
              <p className="mb-3 text-xs text-muted">
                {t("dashboard.plannedHint")}
              </p>
              {plannedLists.length === 0 ? (
                <EmptyState
                  compact
                  title={t("dashboard.upcomingEmptyTitle")}
                  body={t("dashboard.upcomingEmptyBody")}
                />
              ) : (
                <ul className="space-y-2">
                  {plannedLists.map((list) => {
                    const amount =
                      list.planned_budget !== null
                        ? money(toMinor(list.planned_budget))
                        : list.estimated_total !== null
                          ? money(toMinor(list.estimated_total))
                          : null;
                    return (
                      <li key={list.id}>
                        <Link
                          href={`/shopping-lists/${list.id}`}
                          className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--radius-md)] px-1 py-1.5 hover:bg-surface-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {list.name}
                            </span>
                            <span className="text-xs text-muted">
                              {list.checked_count}/{list.item_count} ·{" "}
                              {list.scope === "shared"
                                ? t("common.shared")
                                : t("common.individual")}
                            </span>
                          </span>
                          {amount ? (
                            <span className="tabular shrink-0 text-sm font-medium">
                              {amount}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                  {plannedTotalMinor > 0 ? (
                    <li className="border-t border-border pt-2 text-xs text-muted">
                      {t("dashboard.of", { total: money(plannedTotalMinor) })}
                    </li>
                  ) : null}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>{t("dashboard.reserved")}</CardTitle>
              <p className="mb-3 text-xs text-muted">
                {t("dashboard.reservedHint")}
              </p>
              {summary && summary.reservedTotal > 0 ? (
                <Stat
                  label={t("dashboard.reservedHint")}
                  value={money(summary.reservedTotal)}
                />
              ) : (
                <EmptyState compact title={t("dashboard.reservedEmpty")} />
              )}
            </Card>
          </div>
        </Section>

        {/* Member spending */}
        {summary ? (
          <Section title={t("dashboard.byMember")}>
            <Card>
              {memberSpending.length === 0 ? (
                <EmptyState compact title={t("dashboard.byMemberEmpty")} />
              ) : (
                <ul className="space-y-3">
                  {memberSpending
                    .sort((a, b) => b.expenses - a.expenses)
                    .map((row) => (
                      <li key={row.userId ?? "none"} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {nameOf(row.userId)}
                          </p>
                          <p className="tabular text-sm font-semibold">
                            {money(row.expenses)}
                          </p>
                        </div>
                        <ProgressBar
                          value={row.expenses}
                          max={memberTotal}
                          tone="brand"
                        />
                        <p className="text-xs text-muted">
                          {t("dashboard.sharedVsIndividual", {
                            shared: money(row.sharedExpenses),
                            individual: money(row.individualExpenses),
                          })}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          </Section>
        ) : null}

        {/* Savings — compact */}
        <Section
          title={t("dashboard.savings")}
          action={
            writer ? (
              <Link
                href="/settings#goals"
                className="text-sm font-medium text-brand-strong hover:underline"
              >
                {t("settings.goalCreate")}
              </Link>
            ) : undefined
          }
        >
          <Card>
            {goals.length === 0 ? (
              <EmptyState
                compact
                title={t("dashboard.savingsEmptyTitle")}
                body={t("dashboard.savingsEmptyBody")}
              />
            ) : (
              <ul className="space-y-4">
                {goals.slice(0, 3).map(({ goal, projection }) => (
                  <li key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {goal.name}
                      </p>
                      <Badge
                        tone={
                          projection.status === "completed" ||
                          projection.status === "on_track"
                            ? "ok"
                            : projection.status === "behind" ||
                                projection.status === "stalled"
                              ? "warn"
                              : "default"
                        }
                      >
                        {t(`savings.status.${projection.status}`)}
                      </Badge>
                    </div>
                    <ProgressBar
                      value={projection.current}
                      max={projection.target}
                      tone="brand"
                    />
                    <p className="tabular text-xs text-muted">
                      {t("dashboard.savingsProgress", {
                        current: money(projection.current),
                        target: money(projection.target),
                      })}
                      {goal.scope === "individual"
                        ? ` · ${nameOf(goal.owner_id)}`
                        : ` · ${t("common.shared")}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>

        {/* Recent transactions */}
        <Section
          title={t("dashboard.recent")}
          action={
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong hover:underline"
            >
              {t("dashboard.viewAll")} <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <Card>
              <EmptyState
                title={t("dashboard.recentEmptyTitle")}
                body={t("dashboard.recentEmptyBody")}
                action={
                  writer ? (
                    <AddTransactionButton
                      label={t("dashboard.addTransaction")}
                      {...formProps}
                    />
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <TransactionList
              householdId={household.id}
              currency={household.currency}
              categories={categories}
              members={members}
              currentUserId={ctx.user.id}
              today={today}
              grouped={false}
              transactions={recent.map((tx) => ({
                ...tx,
                editable: admin || (writer && tx.created_by === ctx.user.id),
              }))}
            />
          )}
        </Section>
      </div>
    </>
  );
}
