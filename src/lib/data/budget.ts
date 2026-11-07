import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toMinor } from "@/lib/money";
import type { EngineReservation, EngineTransaction } from "@/lib/budget-engine";
import type {
  BudgetRow,
  CategoryRow,
  ContributionRow,
  InviteRow,
  ReservationRow,
  SavingsGoalRow,
  TransactionRow,
} from "./types";

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

const BUDGET_COLUMNS = "id, name, period, start_date, end_date, spending_limit, grocery_limit, is_active";

function normaliseBudget(b: BudgetRow): BudgetRow {
  return {
    ...b,
    spending_limit: b.spending_limit === null ? null : Number(b.spending_limit),
    grocery_limit: b.grocery_limit === null ? null : Number(b.grocery_limit),
  };
}

export async function getCategories(householdId: string): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transaction_categories")
    .select("id, kind, name, system_key, is_grocery, is_archived, sort_order")
    .eq("household_id", householdId)
    .order("sort_order")
    .order("name");
  if (error) fail("categories", error.message);
  return (data ?? []) as CategoryRow[];
}

export async function getBudgets(householdId: string): Promise<BudgetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_COLUMNS)
    .eq("household_id", householdId)
    .order("start_date", { ascending: false });
  if (error) fail("budgets", error.message);
  return ((data ?? []) as BudgetRow[]).map(normaliseBudget);
}

/** The active budget whose period contains `today`, if any. */
export async function getCurrentBudget(householdId: string, today: string): Promise<BudgetRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_COLUMNS)
    .eq("household_id", householdId)
    .eq("is_active", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();
  if (error) fail("budget", error.message);
  return data ? normaliseBudget(data as BudgetRow) : null;
}

export async function getTransactionsBetween(householdId: string, from: string, to: string): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount, occurred_on, description, category_id, scope, paid_by, created_by, note")
    .eq("household_id", householdId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) fail("transactions", error.message);
  return ((data ?? []) as TransactionRow[]).map((t) => ({ ...t, amount: Number(t.amount) }));
}

export async function getRecentTransactions(householdId: string, limit = 5): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount, occurred_on, description, category_id, scope, paid_by, created_by, note")
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("recent transactions", error.message);
  return ((data ?? []) as TransactionRow[]).map((t) => ({ ...t, amount: Number(t.amount) }));
}

export async function getActiveReservations(budgetId: string): Promise<ReservationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_reservations")
    .select("amount, status, is_grocery")
    .eq("budget_id", budgetId)
    .eq("status", "active");
  if (error) fail("reservations", error.message);
  return ((data ?? []) as ReservationRow[]).map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function getHouseholdBalance(householdId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_balances")
    .select("opening_balance, income_total, expense_total, saved_total, balance, available")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) fail("balance", error.message);
  return {
    openingBalance: toMinor(data?.opening_balance),
    incomeTotal: toMinor(data?.income_total),
    expenseTotal: toMinor(data?.expense_total),
    savedTotal: toMinor(data?.saved_total),
    balance: toMinor(data?.balance),
    available: toMinor(data?.available),
  };
}

export async function getSavingsGoals(householdId: string): Promise<{ goals: SavingsGoalRow[]; contributions: ContributionRow[] }> {
  const supabase = await createClient();
  const [goals, contributions] = await Promise.all([
    supabase
      .from("savings_goals")
      .select("id, name, target_amount, target_date, scope, owner_id, status")
      .eq("household_id", householdId)
      .neq("status", "archived")
      .order("created_at"),
    supabase
      .from("savings_goal_contributions")
      .select("goal_id, user_id, amount, contributed_on")
      .eq("household_id", householdId),
  ]);
  if (goals.error) fail("savings goals", goals.error.message);
  if (contributions.error) fail("contributions", contributions.error.message);
  return {
    goals: ((goals.data ?? []) as SavingsGoalRow[]).map((g) => ({ ...g, target_amount: Number(g.target_amount) })),
    contributions: ((contributions.data ?? []) as ContributionRow[]).map((c) => ({ ...c, amount: Number(c.amount) })),
  };
}

export async function getPendingInvites(householdId: string): Promise<InviteRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_invites")
    .select("id, email, role, status, expires_at, created_at")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) fail("invites", error.message);
  return (data ?? []) as InviteRow[];
}

export function toEngineTransactions(rows: readonly TransactionRow[], categories: readonly CategoryRow[]): EngineTransaction[] {
  const grocery = new Set(categories.filter((c) => c.is_grocery).map((c) => c.id));
  return rows.map((t) => ({
    type: t.type,
    amount: toMinor(t.amount),
    occurredOn: t.occurred_on,
    scope: t.scope,
    paidBy: t.paid_by,
    isGrocery: t.category_id !== null && grocery.has(t.category_id),
  }));
}

export function toEngineReservations(rows: readonly ReservationRow[]): EngineReservation[] {
  return rows.map((r) => ({ amount: toMinor(r.amount), status: r.status, isGrocery: r.is_grocery }));
}
