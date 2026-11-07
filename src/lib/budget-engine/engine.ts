import { addDays, diffDays, isBetween } from "../dates";
import type { Minor } from "../money";
import type {
  BudgetSummary,
  EngineBudget,
  EngineContribution,
  EngineReservation,
  EngineTransaction,
  HouseholdBalance,
  MemberSpending,
  SavingsProjection,
} from "./types";

function sum(values: Iterable<Minor>): Minor {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Days left in the period counting `today`; the whole period before it starts, 0 after it ends. */
export function daysLeftInPeriod(budget: Pick<EngineBudget, "startDate" | "endDate">, today: string): number {
  if (today > budget.endDate) return 0;
  if (today < budget.startDate) return diffDays(budget.startDate, budget.endDate) + 1;
  return diffDays(today, budget.endDate) + 1;
}

/**
 * Summary of one budget period.
 *
 * - Only transactions inside the period count.
 * - Reservations are reported separately and never added to `expenses`; active ones reduce what is left.
 * - The daily allowance divides what is left by the remaining days (today included). Today's own spending is
 *   ignored in the numerator so the allowance stays stable through the day and is recalculated each morning
 *   from everything spent before today; `todayRemaining` shows what is left of today's allowance.
 */
export function computeBudgetSummary(input: {
  budget: EngineBudget;
  transactions: readonly EngineTransaction[];
  reservations: readonly EngineReservation[];
  today: string;
}): BudgetSummary {
  const { budget, transactions, reservations, today } = input;
  const inPeriod = transactions.filter((t) => isBetween(t.occurredOn, budget.startDate, budget.endDate));
  const expenses = inPeriod.filter((t) => t.type === "expense");

  const income = sum(inPeriod.filter((t) => t.type === "income").map((t) => t.amount));
  const expenseTotal = sum(expenses.map((t) => t.amount));
  const groceryExpenses = sum(expenses.filter((t) => t.isGrocery).map((t) => t.amount));
  const sharedExpenses = sum(expenses.filter((t) => t.scope === "shared").map((t) => t.amount));
  const individualExpenses = sum(expenses.filter((t) => t.scope === "individual").map((t) => t.amount));
  const spentBeforeToday = sum(expenses.filter((t) => t.occurredOn < today).map((t) => t.amount));
  const todaySpent = sum(expenses.filter((t) => t.occurredOn === today).map((t) => t.amount));

  const active = reservations.filter((r) => r.status === "active");
  const reservedTotal = sum(active.map((r) => r.amount));
  const reservedGrocery = sum(active.filter((r) => r.isGrocery).map((r) => r.amount));

  const daysLeft = daysLeftInPeriod(budget, today);
  const committed = expenseTotal + reservedTotal;
  const { spendingLimit, groceryLimit } = budget;

  const dailyAllowance =
    spendingLimit === null || daysLeft === 0
      ? null
      : Math.floor(Math.max(0, spendingLimit - spentBeforeToday - reservedTotal) / daysLeft);

  return {
    periodStart: budget.startDate,
    periodEnd: budget.endDate,
    spendingLimit,
    groceryLimit,
    income,
    expenses: expenseTotal,
    groceryExpenses,
    sharedExpenses,
    individualExpenses,
    reservedTotal,
    reservedGrocery,
    committed,
    remaining: spendingLimit === null ? null : spendingLimit - committed,
    groceryRemaining: groceryLimit === null ? null : groceryLimit - groceryExpenses - reservedGrocery,
    daysTotal: diffDays(budget.startDate, budget.endDate) + 1,
    daysLeft,
    dailyAllowance,
    todaySpent,
    todayRemaining: dailyAllowance === null ? null : dailyAllowance - todaySpent,
  };
}

/** All-time household balance. Savings contributions are money moved out of the spendable balance. */
export function computeHouseholdBalance(input: {
  openingBalance: Minor;
  transactions: readonly Pick<EngineTransaction, "type" | "amount">[];
  contributions: readonly Pick<EngineContribution, "amount">[];
}): HouseholdBalance {
  const incomeTotal = sum(input.transactions.filter((t) => t.type === "income").map((t) => t.amount));
  const expenseTotal = sum(input.transactions.filter((t) => t.type === "expense").map((t) => t.amount));
  const savedTotal = sum(input.contributions.map((c) => c.amount));
  const balance = input.openingBalance + incomeTotal - expenseTotal;
  return {
    openingBalance: input.openingBalance,
    incomeTotal,
    expenseTotal,
    savedTotal,
    balance,
    available: balance - savedTotal,
  };
}

/** Income and spending per member (null = unattributed shared money) inside an inclusive date range. */
export function spendingByMember(
  transactions: readonly EngineTransaction[],
  range: { from: string; to: string },
): MemberSpending[] {
  const byUser = new Map<string | null, MemberSpending>();
  for (const t of transactions) {
    if (!isBetween(t.occurredOn, range.from, range.to)) continue;
    let row = byUser.get(t.paidBy);
    if (!row) {
      row = { userId: t.paidBy, income: 0, expenses: 0, sharedExpenses: 0, individualExpenses: 0, groceryExpenses: 0 };
      byUser.set(t.paidBy, row);
    }
    if (t.type === "income") {
      row.income += t.amount;
      continue;
    }
    row.expenses += t.amount;
    if (t.scope === "shared") row.sharedExpenses += t.amount;
    else row.individualExpenses += t.amount;
    if (t.isGrocery) row.groceryExpenses += t.amount;
  }
  return [...byUser.values()];
}

const DAYS_PER_MONTH = 30.4375;
const MIN_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 90;

/**
 * Projects when a savings goal completes.
 *
 * The contribution rate is the net amount contributed over a trailing window (30 to 90 days, growing with the
 * age of the goal so young goals are not under-estimated). The projection assumes that rate continues.
 */
export function projectSavingsGoal(input: {
  target: Minor;
  contributions: readonly EngineContribution[];
  targetDate?: string | null;
  today: string;
}): SavingsProjection {
  const { target, contributions, today } = input;
  const targetDate = input.targetDate ?? null;
  const current = sum(contributions.map((c) => c.amount));
  const remaining = Math.max(0, target - current);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0;

  const base = { target, current, remaining, percent };

  const pastContributions = contributions.filter((c) => c.contributedOn <= today);
  const daysUntilDeadline = targetDate ? diffDays(today, targetDate) : null;
  const requiredMonthly =
    targetDate && daysUntilDeadline !== null && daysUntilDeadline > 0
      ? Math.ceil(remaining / (daysUntilDeadline / DAYS_PER_MONTH))
      : null;

  if (current >= target) {
    return { ...base, monthlyRate: 0, requiredMonthly: null, projectedCompletion: null, status: "completed" };
  }
  if (pastContributions.length === 0) {
    return { ...base, monthlyRate: 0, requiredMonthly, projectedCompletion: null, status: "no_data" };
  }

  const first = pastContributions.reduce((min, c) => (c.contributedOn < min ? c.contributedOn : min), today);
  const windowDays = Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, diffDays(first, today) + 1));
  const windowStart = addDays(today, -(windowDays - 1));
  const net = sum(pastContributions.filter((c) => c.contributedOn >= windowStart).map((c) => c.amount));
  const dailyRate = net / windowDays;
  const monthlyRate = Math.round(dailyRate * DAYS_PER_MONTH);

  if (dailyRate <= 0) {
    return {
      ...base,
      monthlyRate: Math.min(0, monthlyRate),
      requiredMonthly,
      projectedCompletion: null,
      status: "stalled",
    };
  }

  const projectedCompletion = addDays(today, Math.ceil(remaining / dailyRate));
  let status: SavingsProjection["status"] = "no_deadline";
  if (targetDate) status = projectedCompletion <= targetDate ? "on_track" : "behind";
  return { ...base, monthlyRate, requiredMonthly, projectedCompletion, status };
}
