import type { Minor } from "../money";

export type TransactionType = "income" | "expense";
export type SpendingScope = "shared" | "individual";
export type ReservationStatus = "active" | "fulfilled" | "released";

export interface EngineBudget {
  /** inclusive ISO dates */
  startDate: string;
  endDate: string;
  /** null = no limit configured; the engine then reports no allowance */
  spendingLimit: Minor | null;
  groceryLimit: Minor | null;
}

export interface EngineTransaction {
  type: TransactionType;
  amount: Minor;
  occurredOn: string;
  scope: SpendingScope;
  paidBy: string | null;
  isGrocery: boolean;
}

/** Money set aside for planned shopping. Never an actual expense. */
export interface EngineReservation {
  amount: Minor;
  status: ReservationStatus;
  isGrocery: boolean;
}

export interface EngineContribution {
  amount: Minor;
  contributedOn: string;
  userId?: string | null;
}

export interface BudgetSummary {
  periodStart: string;
  periodEnd: string;
  spendingLimit: Minor | null;
  groceryLimit: Minor | null;
  income: Minor;
  /** actual expenses only (reservations excluded) */
  expenses: Minor;
  groceryExpenses: Minor;
  sharedExpenses: Minor;
  individualExpenses: Minor;
  /** active reservations */
  reservedTotal: Minor;
  reservedGrocery: Minor;
  /** expenses + active reservations */
  committed: Minor;
  /** spendingLimit - committed; null without a limit */
  remaining: Minor | null;
  groceryRemaining: Minor | null;
  daysTotal: number;
  /** days left including today (0 once the period is over) */
  daysLeft: number;
  /** spendable per remaining day (floored to whole minor units); null without a limit or once over */
  dailyAllowance: Minor | null;
  todaySpent: Minor;
  /** income dated today (used when projecting tomorrow's rate) */
  todayIncome: Minor;
  /** allowance for today minus what was already spent today; null when there is no allowance */
  todayRemaining: Minor | null;
}

/**
 * Forward-looking daily rate after today's actual spending and today's income.
 * Distinct from `dailyAllowance`, which stays stable through the day.
 */
export interface TomorrowAllowance {
  /** days left after today (0 on the last day of the period) */
  daysFromTomorrow: number;
  /**
   * Spendable per day from tomorrow onward (floored). Null without a limit or when there is no
   * tomorrow left in the period. Clamped to 0 when the period is already over budget.
   */
  tomorrowAllowance: Minor | null;
  /** `tomorrowAllowance - dailyAllowance` when both are defined; shows the effect of today's activity */
  allowanceDelta: Minor | null;
  /** true when limit − expenses − reserved + today's income is negative */
  overBudget: boolean;
  /** spendable pool used for the tomorrow rate (before ÷ by days); null without a limit */
  remainingAfterToday: Minor | null;
}

export interface HouseholdBalance {
  openingBalance: Minor;
  incomeTotal: Minor;
  expenseTotal: Minor;
  savedTotal: Minor;
  /** opening + income - expenses */
  balance: Minor;
  /** balance - money set aside in savings goals */
  available: Minor;
}

export interface MemberSpending {
  userId: string | null;
  income: Minor;
  expenses: Minor;
  sharedExpenses: Minor;
  individualExpenses: Minor;
  groceryExpenses: Minor;
}

export type SavingsStatus = "completed" | "on_track" | "behind" | "stalled" | "no_deadline" | "no_data";

export interface SavingsProjection {
  target: Minor;
  current: Minor;
  remaining: Minor;
  percent: number;
  /** net contribution rate over the trailing window, per 30.4375-day month */
  monthlyRate: Minor;
  /** needed per month to hit the deadline; null without a (future) deadline */
  requiredMonthly: Minor | null;
  projectedCompletion: string | null;
  status: SavingsStatus;
}
