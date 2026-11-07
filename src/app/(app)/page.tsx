import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ShoppingBasket,
  Target,
  Wallet,
} from "lucide-react";
import { BudgetEvolutionChart } from "@/components/dashboard/budget-evolution-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { QuickLists } from "@/components/dashboard/quick-lists";
import { RecentPurchases } from "@/components/dashboard/recent-purchases";
import { RecipePromo } from "@/components/dashboard/recipe-promo";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { AddTransactionButton } from "@/components/transaction-form";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
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
  buildCategorySlices,
  buildEvolutionSeries,
  type EvolutionRange,
} from "@/lib/dashboard-charts";
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
import { getImageUrls, getRecipesWithIngredients } from "@/lib/data/recipes";
import { getShoppingListPreviews } from "@/lib/data/shopping-lists";
import { canWrite, isAdmin } from "@/lib/data/types";
import { addDays, currentMonth, diffDays } from "@/lib/dates";
import { formatMonthLabel, todayFor } from "@/lib/format";
import { categoryLabel } from "@/lib/i18n/category";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.dashboard") };
}

function avatarLetter(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export default async function DashboardPage() {
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const today = todayFor(household.timezone);
  const money = (minor: number) => formatMoney(minor, household.currency, locale);
  const firstName = ctx.displayName.trim().split(/\s+/)[0] || ctx.displayName;
  const month = currentMonth(today);

  const [
    budget,
    categories,
    members,
    balance,
    recent,
    goalData,
    plannedLists,
    recipes,
  ] = await Promise.all([
    getCurrentBudget(household.id, today),
    getCategories(household.id),
    getMembers(household.id),
    getHouseholdBalance(household.id),
    getRecentTransactions(household.id, 5),
    getSavingsGoals(household.id),
    getShoppingListPreviews(household.id),
    getRecipesWithIngredients(household.id),
  ]);

  const chartFrom = addDays(today, -364);
  const chartTransactions = await getTransactionsBetween(household.id, chartFrom, today);

  const periodTransactions = budget
    ? await getTransactionsBetween(household.id, budget.start_date, budget.end_date)
    : [];
  const reservations = budget ? await getActiveReservations(budget.id) : [];
  const engineTransactions = toEngineTransactions(periodTransactions, categories);

  const summary = budget
    ? computeBudgetSummary({
        budget: {
          startDate: budget.start_date,
          endDate: budget.end_date,
          spendingLimit:
            budget.spending_limit === null ? null : toMinor(budget.spending_limit),
          groceryLimit:
            budget.grocery_limit === null ? null : toMinor(budget.grocery_limit),
        },
        transactions: engineTransactions,
        reservations: toEngineReservations(reservations),
        today,
      })
    : null;

  const tomorrow = summary
    ? computeTomorrowAllowance({
        spendingLimit: summary.spendingLimit,
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
    members.find((m) => m.user_id === id)?.display_name ?? t("common.unattributed");
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

  const expenseRows = chartTransactions
    .filter((tx) => tx.type === "expense")
    .map((tx) => ({ occurredOn: tx.occurred_on, amount: toMinor(tx.amount) }));

  // Cumulative chart guide uses the period spending limit (density reference).
  const budgetGuide = summary?.spendingLimit ?? null;
  const seriesByRange = {
    "7d": buildEvolutionSeries({
      today,
      range: "7d",
      expenses: expenseRows,
      budgetLimit: budgetGuide,
    }),
    "30d": buildEvolutionSeries({
      today,
      range: "30d",
      expenses: expenseRows,
      budgetLimit: budgetGuide,
    }),
    "3m": buildEvolutionSeries({
      today,
      range: "3m",
      expenses: expenseRows,
      budgetLimit: budgetGuide,
    }),
    "12m": buildEvolutionSeries({
      today,
      range: "12m",
      expenses: expenseRows,
      budgetLimit: budgetGuide,
    }),
  } satisfies Record<EvolutionRange, ReturnType<typeof buildEvolutionSeries>>;

  const categoryTotals = new Map<string, number>();
  for (const tx of periodTransactions) {
    if (tx.type !== "expense") continue;
    const key = tx.category_id ?? "__none__";
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + toMinor(tx.amount));
  }
  const categorySlices = buildCategorySlices(
    [...categoryTotals.entries()].map(([id, amount]) => {
      if (id === "__none__") {
        return { id, label: t("common.expense"), amount };
      }
      const cat = categories.find((c) => c.id === id);
      return {
        id,
        label: cat ? categoryLabel(t, cat) : t("common.expense"),
        amount,
      };
    }),
  );

  const remaining = summary?.remaining ?? null;
  const spendingLimit = summary?.spendingLimit ?? null;
  const remainingPct =
    spendingLimit !== null && spendingLimit > 0 && remaining !== null
      ? Math.round(Math.min(100, Math.max(0, (Math.max(remaining, 0) / spendingLimit) * 100)))
      : null;

  // Real prior-period comparison for the insight callout (30d vs previous 30d).
  const periodLen =
    budget != null ? Math.max(1, diffDays(budget.start_date, budget.end_date) + 1) : 30;
  const prevEnd = budget ? addDays(budget.start_date, -1) : addDays(today, -periodLen);
  const prevStart = addDays(prevEnd, -(periodLen - 1));
  let prevExpenses = 0;
  for (const tx of chartTransactions) {
    if (tx.type !== "expense") continue;
    if (tx.occurred_on < prevStart || tx.occurred_on > prevEnd) continue;
    prevExpenses += toMinor(tx.amount);
  }
  const currentExpenses = summary?.expenses ?? 0;
  let insight: string | null = t("dashboard.insightEmpty");
  if (prevExpenses > 0 && currentExpenses > 0) {
    const delta = (currentExpenses - prevExpenses) / prevExpenses;
    const pct = Math.round(Math.abs(delta) * 100);
    if (pct === 0) insight = t("dashboard.insightSame");
    else if (delta < 0) insight = t("dashboard.insightLess", { pct });
    else insight = t("dashboard.insightMore", { pct });
  } else if (currentExpenses > 0 && prevExpenses === 0) {
    insight = t("dashboard.insightEmpty");
  }

  const todayTone =
    summary?.todayRemaining === null || summary?.todayRemaining === undefined
      ? "default"
      : summary.todayRemaining < 0
        ? summary.todayRemaining < -(summary.dailyAllowance ?? 0) * 0.25
          ? "danger"
          : "warn"
        : "default";

  const recommended = recipes.find((r) => r.is_favorite) ?? recipes[0] ?? null;
  const recipeImages = recommended ? await getImageUrls([recommended.image_path]) : {};

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
            {t("dashboard.greeting", { name: firstName })}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium shadow-sm">
            <CalendarDays size={16} className="text-muted" aria-hidden />
            <span className="capitalize">{formatMonthLabel(month, locale)}</span>
            <ChevronDown size={14} className="text-muted" aria-hidden />
          </div>
          <details className="relative">
            <summary
              className="relative inline-flex size-10 list-none items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm marker:content-none [&::-webkit-details-marker]:hidden"
              aria-label={t("dashboard.notifications")}
            >
              <Bell size={18} aria-hidden />
              <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-danger" aria-hidden />
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm text-muted shadow-[var(--shadow-card)]">
              {t("dashboard.notificationsEmpty")}
            </div>
          </details>
          <span
            className="inline-flex size-10 items-center justify-center rounded-full brand-gradient text-sm font-semibold text-brand-fg"
            title={ctx.displayName}
          >
            {avatarLetter(ctx.displayName)}
          </span>
          {writer ? (
            <AddTransactionButton label={t("dashboard.addTransaction")} {...formProps} />
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            tone="green"
            icon={<Wallet size={18} aria-hidden />}
            label={t("dashboard.available")}
            value={money(balance.available)}
            hint={t("dashboard.availableHint")}
          />
          <SummaryCard
            tone="blue"
            icon={<ShoppingBasket size={18} aria-hidden />}
            label={t("dashboard.monthExpenses")}
            value={money(summary?.expenses ?? 0)}
          />
          <SummaryCard
            tone="purple"
            icon={<Target size={18} aria-hidden />}
            label={t("dashboard.paidFromBudget")}
            value={
              summary?.dailyAllowance === null || summary?.dailyAllowance === undefined
                ? "—"
                : money(summary.dailyAllowance)
            }
            hint={
              tomorrow?.tomorrowAllowance !== null && tomorrow?.tomorrowAllowance !== undefined
                ? t("dashboard.tomorrowHintShort", { amount: money(tomorrow.tomorrowAllowance) })
                : undefined
            }
          />
          <SummaryCard
            tone="orange"
            icon={<Target size={18} aria-hidden />}
            label={t("dashboard.remainingToSpend")}
            value={remaining === null ? "—" : money(Math.max(remaining, 0))}
            hint={
              spendingLimit === null
                ? t("dashboard.noLimitBody")
                : t("dashboard.remainingOf", { total: money(spendingLimit) })
            }
            trailing={
              remainingPct === null ? (
                <ProgressRing value={0} max={1} label="—" tone="orange" />
              ) : (
                <ProgressRing
                  value={Math.max(remaining ?? 0, 0)}
                  max={spendingLimit ?? 1}
                  label={`${remainingPct}%`}
                  tone="orange"
                />
              )
            }
          />
        </div>

        {summary === null ? (
          <Card>
            <EmptyState
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
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <BudgetEvolutionChart seriesByRange={seriesByRange} currency={household.currency} />
          <CategoryDonut
            title={t("dashboard.categories")}
            detailsLabel={t("dashboard.categoriesDetails")}
            emptyTitle={t("dashboard.categoriesEmpty")}
            slices={categorySlices}
            centerLabel={t("dashboard.totalSpent")}
            totalLabel={money(summary?.expenses ?? 0)}
            insight={insight}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <RecentPurchases
            title={t("dashboard.recent")}
            viewAll={t("dashboard.viewAll")}
            emptyTitle={t("dashboard.recentEmptyTitle")}
            emptyBody={t("dashboard.recentEmptyBody")}
            transactions={recent}
            categories={categories}
            currency={household.currency}
            locale={locale}
            t={t}
            today={today}
          />
          <QuickLists
            title={t("dashboard.quickLists")}
            viewAll={t("dashboard.viewAll")}
            emptyTitle={t("dashboard.quickListsEmpty")}
            addLabel={t("dashboard.addToList")}
            lists={plannedLists}
            canAdd={writer}
          />
          <RecipePromo
            title={t("dashboard.recipePromoTitle")}
            body={t("dashboard.recipePromoBody")}
            cta={recommended ? t("dashboard.recipePromoCta") : t("dashboard.recipeExploreCta")}
            recipe={
              recommended
                ? {
                    id: recommended.id,
                    title: recommended.title,
                    imageUrl: recommended.image_path
                      ? (recipeImages[recommended.image_path] ?? null)
                      : null,
                    minutes: (recommended.prep_minutes ?? 0) + (recommended.cook_minutes ?? 0),
                    servings: recommended.servings,
                  }
                : null
            }
          />
        </div>

        {summary ? (
          <Section title={t("dashboard.spendingPace")}>
            <Card>
              {summary.dailyAllowance === null || summary.todayRemaining === null ? (
                <EmptyState
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
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Stat
                      label={t("common.today")}
                      value={money(summary.dailyAllowance)}
                      hint={t("dashboard.allowanceHint", {
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
                        ? t("dashboard.todayOver", { amount: money(-summary.todayRemaining) })
                        : summary.todayRemaining === 0
                          ? t("dashboard.todayOnPace")
                          : t("dashboard.todayLeft", { amount: money(summary.todayRemaining) })}
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
                          hint={
                            tomorrow.remainingAfterToday !== null
                              ? t("dashboard.tomorrowHint", {
                                  amount: money(Math.max(tomorrow.remainingAfterToday, 0)),
                                  days: t("common.days", {
                                    count: tomorrow.daysFromTomorrow,
                                  }),
                                })
                              : undefined
                          }
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
        ) : null}

        {summary ? (
          <Section title={t("dashboard.budgetProgress")}>
            <div className="grid gap-3 sm:grid-cols-2">
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
                      summary.groceryRemaining !== null && summary.groceryRemaining < 0
                        ? "danger"
                        : "default"
                    }
                  />
                  {summary.groceryLimit !== null ? (
                    <ProgressBar
                      value={summary.groceryExpenses + summary.reservedGrocery}
                      max={summary.groceryLimit}
                    />
                  ) : null}
                </div>
              </Card>
              <Card>
                <CardTitle>{t("dashboard.reserved")}</CardTitle>
                {summary.reservedTotal > 0 ? (
                  <Stat label={t("dashboard.reservedHint")} value={money(summary.reservedTotal)} />
                ) : (
                  <EmptyState compact title={t("dashboard.reservedEmpty")} />
                )}
              </Card>
            </div>
          </Section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
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
                            <p className="truncate text-sm font-medium">{nameOf(row.userId)}</p>
                            <p className="tabular text-sm font-semibold">{money(row.expenses)}</p>
                          </div>
                          <ProgressBar value={row.expenses} max={memberTotal} tone="brand" />
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
                        <p className="truncate text-sm font-medium">{goal.name}</p>
                        <Badge
                          tone={
                            projection.status === "completed" || projection.status === "on_track"
                              ? "ok"
                              : projection.status === "behind" || projection.status === "stalled"
                                ? "warn"
                                : "default"
                          }
                        >
                          {t(`savings.status.${projection.status}`)}
                        </Badge>
                      </div>
                      <ProgressBar value={projection.current} max={projection.target} tone="brand" />
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
        </div>
      </div>
    </>
  );
}
