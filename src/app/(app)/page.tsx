import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Search,
  Target,
  Wallet,
} from "lucide-react";
import { BudgetEvolutionChart } from "@/components/dashboard/budget-evolution-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { RecipePromo } from "@/components/dashboard/recipe-promo";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { AddTransactionButton } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import {
  Card,
  EmptyState,
  buttonClass,
} from "@/components/ui";
import {
  computeBudgetSummary,
  computeTomorrowAllowance,
  projectSavingsGoal,
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
import { canWrite, isAdmin } from "@/lib/data/types";
import { addDays, currentMonth } from "@/lib/dates";
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
  const month = currentMonth(today);

  const [
    budget,
    categories,
    members,
    balance,
    recent,
    goalData,
  ] = await Promise.all([
    getCurrentBudget(household.id, today),
    getCategories(household.id),
    getMembers(household.id),
    getHouseholdBalance(household.id),
    getRecentTransactions(household.id, 5),
    getSavingsGoals(household.id),
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

  const seriesByRange = {
    "7d": buildEvolutionSeries({
      today,
      range: "7d",
      expenses: expenseRows,
      budgetLimit: summary?.spendingLimit ?? null,
    }),
    "30d": buildEvolutionSeries({
      today,
      range: "30d",
      expenses: expenseRows,
      budgetLimit: summary?.spendingLimit ?? null,
    }),
    "3m": buildEvolutionSeries({
      today,
      range: "3m",
      expenses: expenseRows,
      budgetLimit: summary?.spendingLimit ?? null,
    }),
    "12m": buildEvolutionSeries({
      today,
      range: "12m",
      expenses: expenseRows,
      budgetLimit: summary?.spendingLimit ?? null,
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
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#111321] px-5 py-5 shadow-[0_24px_80px_-42px_#7c5cff] sm:px-7 sm:py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/recipe-promo.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111321] via-[#111321]/90 to-[#111321]/35" />
        <div className="relative">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white/55 shadow-inner sm:max-w-xl">
              <Search size={18} className="shrink-0 text-white/80" aria-hidden />
              <span className="truncate">Caută produse, rețete sau magazine...</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <span className="hidden text-xs sm:block">{formatMonthLabel(month, locale)}</span>
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]"><Bell size={16} aria-hidden /></span>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-fg" title={ctx.displayName}>{avatarLetter(ctx.displayName)}</span>
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{t("dashboard.greeting", { name: ctx.displayName })}</h1>
          <p className="mt-1 text-sm text-white/60">{t("dashboard.subtitle")}</p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard tone="blue" icon={<Wallet size={19} aria-hidden />} label={t("dashboard.available")} value={money(balance.available)} hint={t("dashboard.availableHint")} />
        <SummaryCard tone="green" icon={<ProgressRing value={summary?.expenses ?? 0} max={summary?.spendingLimit ?? 1} label="" size={42} stroke={5} />} label={t("dashboard.monthExpenses")} value={money(summary?.expenses ?? 0)} hint={summary?.spendingLimit ? `${Math.round(((summary.expenses ?? 0) / summary.spendingLimit) * 100)}%` : undefined} />
        <SummaryCard tone="purple" icon={<Target size={19} aria-hidden />} label={t("dashboard.remainingToSpend")} value={remaining === null ? "—" : money(Math.max(remaining, 0))} hint={spendingLimit === null ? t("dashboard.noLimitBody") : t("dashboard.remainingOf", { total: money(spendingLimit) })} />
        <SummaryCard tone="orange" icon={<Wallet size={19} aria-hidden />} label={t("dashboard.paidFromBudget")} value={summary?.dailyAllowance === null || summary?.dailyAllowance === undefined ? "—" : money(summary.dailyAllowance)} hint={tomorrow?.tomorrowAllowance !== null && tomorrow?.tomorrowAllowance !== undefined ? `${t("dashboard.tomorrowAllowance")}: ${money(tomorrow.tomorrowAllowance)}` : undefined} />
      </div>

      {summary === null ? (
        <Card><EmptyState title={t("dashboard.noBudgetTitle")} body={t("dashboard.noBudgetBody")} action={admin ? <Link href="/settings#budget" className={buttonClass("secondary")}>{t("settings.budgetCreate")}</Link> : undefined} /></Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
        <BudgetEvolutionChart seriesByRange={seriesByRange} currency={household.currency} />
        <CategoryDonut title={t("dashboard.categories")} detailsLabel={t("dashboard.categoriesDetails")} emptyTitle={t("dashboard.categoriesEmpty")} slices={categorySlices} centerLabel={t("dashboard.monthExpenses")} totalLabel={money(summary?.expenses ?? 0)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_0.9fr]">
        <section className="min-w-0 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-fg">{t("dashboard.recent")}</h2><Link href="/transactions" className="text-xs font-medium text-brand-strong">{t("dashboard.viewAll")} <ArrowRight className="inline" size={12} aria-hidden /></Link></div>
          {recent.length === 0 ? <EmptyState compact title={t("dashboard.recentEmptyTitle")} body={t("dashboard.recentEmptyBody")} action={writer ? <AddTransactionButton label={t("dashboard.addTransaction")} {...formProps} /> : undefined} /> : <TransactionList householdId={household.id} currency={household.currency} categories={categories} members={members} currentUserId={ctx.user.id} today={today} grouped={false} transactions={recent.map((tx) => ({ ...tx, editable: admin || (writer && tx.created_by === ctx.user.id) }))} />}
        </section>

        <section className="min-w-0 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-fg">Produse populare</h2><Link href="/products" className="text-xs font-medium text-brand-strong">{t("dashboard.viewAll")} <ArrowRight className="inline" size={12} aria-hidden /></Link></div>
          {categorySlices.length === 0 ? <EmptyState compact title={t("dashboard.categoriesEmpty")} /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{categorySlices.slice(0, 4).map((slice) => <Link key={slice.id} href="/products" className="group rounded-[14px] border border-border bg-surface-2 p-3 transition hover:-translate-y-1 hover:border-brand/60"><span className="mb-3 flex h-20 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${slice.color} 18%, transparent)` }}><span className="size-10 rounded-full" style={{ background: slice.color }} /></span><span className="block truncate text-sm font-medium text-fg">{slice.label}</span><span className="mt-1 block text-sm font-semibold text-fg">{money(slice.amount)}</span><span className="mt-1 block text-xs text-ok">{slice.percent}%</span></Link>)}</div>}
        </section>

        <RecipePromo title={t("dashboard.recipePromoTitle")} body={t("dashboard.recipePromoBody")} cta={t("dashboard.recipePromoCta")} />
      </div>

      {summary ? <div className="grid gap-4 lg:grid-cols-2"><Card><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted">{t("dashboard.spendingPace")}</p><p className="mt-1 text-2xl font-semibold text-fg">{summary.dailyAllowance === null ? "—" : money(summary.dailyAllowance)}</p></div><ProgressRing value={Math.max(summary.todaySpent, 0)} max={Math.max(summary.dailyAllowance ?? 1, 1)} label={`${Math.round((Math.max(summary.todaySpent, 0) / Math.max(summary.dailyAllowance ?? 1, 1)) * 100)}%`} /></div><p className="mt-3 text-sm text-muted">{t("dashboard.todaySpent", { amount: money(summary.todaySpent) })}</p></Card><Card><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted">{t("dashboard.savings")}</p><p className="mt-1 text-2xl font-semibold text-fg">{goals.length}</p></div><Link href="/settings#goals" className="text-xs font-medium text-brand-strong">{t("settings.goalCreate")} <ArrowRight className="inline" size={12} aria-hidden /></Link></div><p className="mt-3 text-sm text-muted">{goals.length === 0 ? t("dashboard.savingsEmptyBody") : goals[0]?.goal.name}</p></Card></div> : null}
    </div>
  );
}
