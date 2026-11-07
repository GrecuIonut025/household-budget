import { describe, expect, it } from "vitest";
import {
  computeBudgetSummary,
  computeHouseholdBalance,
  computeTomorrowAllowance,
  daysLeftInPeriod,
  projectSavingsGoal,
  spendingByMember,
} from "./engine";
import type { EngineBudget, EngineReservation, EngineTransaction } from "./types";

const m = (n: number) => Math.round(n * 100);

const budget: EngineBudget = {
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  spendingLimit: m(3000),
  groceryLimit: m(1000),
};

const tx = (over: Partial<EngineTransaction> & Pick<EngineTransaction, "amount" | "occurredOn">): EngineTransaction => ({
  type: "expense",
  scope: "shared",
  paidBy: null,
  isGrocery: false,
  ...over,
});

// Same scenario as supabase/tests/database/05-budget-engine.test.sql
const transactions: EngineTransaction[] = [
  tx({ type: "income", amount: m(5000), occurredOn: "2026-11-01" }),
  tx({ amount: m(42), occurredOn: "2026-11-03", isGrocery: true, paidBy: "alice" }),
  tx({ amount: m(200), occurredOn: "2026-11-02", isGrocery: true }),
  tx({ amount: m(100), occurredOn: "2026-11-07", isGrocery: true, scope: "individual", paidBy: "alice" }),
  tx({ amount: m(1000), occurredOn: "2026-11-03" }),
  tx({ amount: m(50), occurredOn: "2026-11-07" }),
  tx({ amount: m(999), occurredOn: "2026-10-31" }),
  tx({ amount: m(999), occurredOn: "2026-12-01" }),
];

const reservations: EngineReservation[] = [
  { amount: m(100), status: "active", isGrocery: true },
  { amount: m(200), status: "active", isGrocery: true },
  { amount: m(150), status: "fulfilled", isGrocery: true },
  { amount: m(100), status: "released", isGrocery: true },
];

describe("computeBudgetSummary", () => {
  const summary = computeBudgetSummary({ budget, transactions, reservations, today: "2026-11-07" });

  it("counts only in-period expenses and keeps reservations out of them", () => {
    expect(summary.income).toBe(m(5000));
    expect(summary.expenses).toBe(m(1392));
    expect(summary.groceryExpenses).toBe(m(342));
    expect(summary.sharedExpenses).toBe(m(1292));
    expect(summary.individualExpenses).toBe(m(100));
  });

  it("reports only active reservations and subtracts them from what is left", () => {
    expect(summary.reservedTotal).toBe(m(300));
    expect(summary.reservedGrocery).toBe(m(300));
    expect(summary.committed).toBe(m(1692));
    expect(summary.remaining).toBe(m(1308));
    expect(summary.groceryRemaining).toBe(m(358));
  });

  it("recalculates the daily allowance from spending before today", () => {
    expect(summary.daysTotal).toBe(30);
    expect(summary.daysLeft).toBe(24);
    expect(summary.dailyAllowance).toBe(m(60.75));
    expect(summary.todaySpent).toBe(m(150));
    expect(summary.todayIncome).toBe(0);
    expect(summary.todayRemaining).toBe(m(60.75) - m(150));
  });

  it("matches the SQL engine after a reservation is fulfilled", () => {
    const afterFulfil = computeBudgetSummary({
      budget,
      transactions: [...transactions, tx({ amount: m(180), occurredOn: "2026-11-05", isGrocery: true })],
      reservations: reservations.map((r, i) => (i === 1 ? { ...r, status: "fulfilled" as const } : r)),
      today: "2026-11-07",
    });
    expect(afterFulfil.expenses).toBe(m(1572));
    expect(afterFulfil.reservedTotal).toBe(m(100));
    expect(afterFulfil.dailyAllowance).toBe(Math.floor((m(3000) - m(1422) - m(100)) / 24));
  });

  it("does not invent an allowance without a spending limit", () => {
    const s = computeBudgetSummary({ budget: { ...budget, spendingLimit: null }, transactions, reservations, today: "2026-11-07" });
    expect(s.remaining).toBeNull();
    expect(s.dailyAllowance).toBeNull();
    expect(s.todayRemaining).toBeNull();
    expect(s.groceryRemaining).toBe(m(358));
  });

  it("clamps the allowance to zero when overspent", () => {
    const s = computeBudgetSummary({ budget: { ...budget, spendingLimit: m(1000) }, transactions, reservations, today: "2026-11-07" });
    expect(s.dailyAllowance).toBe(0);
    expect(s.remaining).toBeLessThan(0);
  });

  it("handles dates before and after the period", () => {
    expect(daysLeftInPeriod(budget, "2026-10-15")).toBe(30);
    expect(daysLeftInPeriod(budget, "2026-11-30")).toBe(1);
    expect(daysLeftInPeriod(budget, "2026-12-15")).toBe(0);
    const over = computeBudgetSummary({ budget, transactions, reservations, today: "2026-12-15" });
    expect(over.dailyAllowance).toBeNull();
  });

  it("floors the allowance so it never overspends by rounding", () => {
    const s = computeBudgetSummary({
      budget: { startDate: "2026-11-01", endDate: "2026-11-03", spendingLimit: 1000, groceryLimit: null },
      transactions: [],
      reservations: [],
      today: "2026-11-01",
    });
    expect(s.dailyAllowance).toBe(333);
  });

  it("works with empty inputs", () => {
    const s = computeBudgetSummary({ budget, transactions: [], reservations: [], today: "2026-11-07" });
    expect(s.expenses).toBe(0);
    expect(s.remaining).toBe(m(3000));
    expect(s.dailyAllowance).toBe(Math.floor(m(3000) / 24));
  });
});

describe("computeTomorrowAllowance", () => {
  const base = computeBudgetSummary({ budget, transactions, reservations, today: "2026-11-07" });

  it("divides remaining after today's spending by days left excluding today", () => {
    const t = computeTomorrowAllowance({
      spendingLimit: base.spendingLimit,
      todayIncome: base.todayIncome,
      expenses: base.expenses,
      reservedTotal: base.reservedTotal,
      daysLeft: base.daysLeft,
      dailyAllowance: base.dailyAllowance,
    });
    // remaining 1308 / 23 days from tomorrow
    expect(t.daysFromTomorrow).toBe(23);
    expect(t.remainingAfterToday).toBe(m(1308));
    expect(t.tomorrowAllowance).toBe(Math.floor(m(1308) / 23));
    expect(t.overBudget).toBe(false);
    expect(t.allowanceDelta).toBe(t.tomorrowAllowance! - base.dailyAllowance!);
  });

  it("raises tomorrow's rate when income arrives today", () => {
    const withIncome = computeBudgetSummary({
      budget,
      transactions: [...transactions, tx({ type: "income", amount: m(230), occurredOn: "2026-11-07" })],
      reservations,
      today: "2026-11-07",
    });
    expect(withIncome.todayIncome).toBe(m(230));
    const before = computeTomorrowAllowance({
      spendingLimit: base.spendingLimit,
      todayIncome: base.todayIncome,
      expenses: base.expenses,
      reservedTotal: base.reservedTotal,
      daysLeft: base.daysLeft,
      dailyAllowance: base.dailyAllowance,
    });
    const after = computeTomorrowAllowance({
      spendingLimit: withIncome.spendingLimit,
      todayIncome: withIncome.todayIncome,
      expenses: withIncome.expenses,
      reservedTotal: withIncome.reservedTotal,
      daysLeft: withIncome.daysLeft,
      dailyAllowance: withIncome.dailyAllowance,
    });
    expect(after.tomorrowAllowance).toBe(before.tomorrowAllowance! + m(10)); // 230 / 23
    expect(after.allowanceDelta).toBeGreaterThan(before.allowanceDelta!);
  });

  it("clamps to zero and flags over-budget when remaining is negative", () => {
    const over = computeBudgetSummary({
      budget: { ...budget, spendingLimit: m(1000) },
      transactions,
      reservations,
      today: "2026-11-07",
    });
    const t = computeTomorrowAllowance({
      spendingLimit: over.spendingLimit,
      todayIncome: over.todayIncome,
      expenses: over.expenses,
      reservedTotal: over.reservedTotal,
      daysLeft: over.daysLeft,
      dailyAllowance: over.dailyAllowance,
    });
    expect(t.remainingAfterToday).toBeLessThan(0);
    expect(t.tomorrowAllowance).toBe(0);
    expect(t.overBudget).toBe(true);
  });

  it("omits the tomorrow line on the last day of the period", () => {
    const last = computeBudgetSummary({ budget, transactions, reservations, today: "2026-11-30" });
    expect(last.daysLeft).toBe(1);
    const t = computeTomorrowAllowance({
      spendingLimit: last.spendingLimit,
      todayIncome: last.todayIncome,
      expenses: last.expenses,
      reservedTotal: last.reservedTotal,
      daysLeft: last.daysLeft,
      dailyAllowance: last.dailyAllowance,
    });
    expect(t.daysFromTomorrow).toBe(0);
    expect(t.tomorrowAllowance).toBeNull();
    expect(t.allowanceDelta).toBeNull();
  });

  it("holds active reservations out of tomorrow's pool", () => {
    const withRes = computeTomorrowAllowance({
      spendingLimit: base.spendingLimit,
      todayIncome: 0,
      expenses: base.expenses,
      reservedTotal: base.reservedTotal,
      daysLeft: base.daysLeft,
      dailyAllowance: base.dailyAllowance,
    });
    const withoutRes = computeTomorrowAllowance({
      spendingLimit: base.spendingLimit,
      todayIncome: 0,
      expenses: base.expenses,
      reservedTotal: 0,
      daysLeft: base.daysLeft,
      dailyAllowance: base.dailyAllowance,
    });
    expect(withRes.tomorrowAllowance).toBeLessThan(withoutRes.tomorrowAllowance!);
    expect(withoutRes.remainingAfterToday! - withRes.remainingAfterToday!).toBe(base.reservedTotal);
  });

  it("returns nulls without a spending limit", () => {
    const t = computeTomorrowAllowance({
      spendingLimit: null,
      todayIncome: 0,
      expenses: base.expenses,
      reservedTotal: base.reservedTotal,
      daysLeft: base.daysLeft,
      dailyAllowance: null,
    });
    expect(t.tomorrowAllowance).toBeNull();
    expect(t.allowanceDelta).toBeNull();
    expect(t.remainingAfterToday).toBeNull();
    expect(t.overBudget).toBe(false);
  });
});

describe("computeHouseholdBalance", () => {
  it("combines opening balance, income, expenses and savings", () => {
    const b = computeHouseholdBalance({
      openingBalance: m(100),
      transactions,
      contributions: [{ amount: m(100) }, { amount: m(500) }],
    });
    expect(b).toEqual({
      openingBalance: m(100),
      incomeTotal: m(5000),
      expenseTotal: m(3390),
      savedTotal: m(600),
      balance: m(1710),
      available: m(1110),
    });
  });
});

describe("spendingByMember", () => {
  const rows = spendingByMember(transactions, { from: "2026-11-01", to: "2026-11-30" });
  it("attributes spending per member and keeps unattributed money separate", () => {
    const alice = rows.find((r) => r.userId === "alice");
    expect(alice).toMatchObject({ expenses: m(142), individualExpenses: m(100), groceryExpenses: m(142) });
    const shared = rows.find((r) => r.userId === null);
    expect(shared).toMatchObject({ income: m(5000), expenses: m(1250) });
  });
});

describe("projectSavingsGoal", () => {
  const today = "2026-11-07";

  it("reports no_data without contributions", () => {
    const p = projectSavingsGoal({ target: m(2000), contributions: [], today });
    expect(p).toMatchObject({ status: "no_data", current: 0, remaining: m(2000), percent: 0, projectedCompletion: null });
  });

  it("projects completion from the trailing contribution rate", () => {
    const p = projectSavingsGoal({
      target: m(1000),
      contributions: [
        { amount: m(100), contributedOn: "2026-09-08" },
        { amount: m(100), contributedOn: "2026-10-08" },
        { amount: m(100), contributedOn: "2026-11-05" },
      ],
      today,
    });
    expect(p.current).toBe(m(300));
    expect(p.percent).toBe(30);
    expect(p.status).toBe("no_deadline");
    expect(p.monthlyRate).toBeGreaterThan(m(90));
    expect(p.projectedCompletion).not.toBeNull();
    expect(p.projectedCompletion! > today).toBe(true);
  });

  it("flags goals that are on track or behind their deadline", () => {
    const contributions = [{ amount: m(500), contributedOn: "2026-11-01" }];
    const onTrack = projectSavingsGoal({ target: m(1000), contributions, targetDate: "2027-12-31", today });
    expect(onTrack.status).toBe("on_track");
    const behind = projectSavingsGoal({ target: m(1000), contributions, targetDate: "2026-12-01", today });
    expect(behind.status).toBe("behind");
    expect(behind.requiredMonthly).toBeGreaterThan(m(400));
  });

  it("is completed once the target is reached", () => {
    const p = projectSavingsGoal({ target: m(100), contributions: [{ amount: m(120), contributedOn: "2026-11-01" }], today });
    expect(p).toMatchObject({ status: "completed", remaining: 0, percent: 100 });
  });

  it("marks goals with only old or negative net contributions as stalled", () => {
    const old = projectSavingsGoal({
      target: m(1000),
      contributions: [
        { amount: m(100), contributedOn: "2026-01-01" },
        { amount: m(-100), contributedOn: "2026-10-20" },
        { amount: m(50), contributedOn: "2026-10-25" },
      ],
      today,
    });
    expect(old.status).toBe("stalled");
    expect(old.projectedCompletion).toBeNull();
  });

  it("ignores contributions dated in the future", () => {
    const p = projectSavingsGoal({ target: m(1000), contributions: [{ amount: m(100), contributedOn: "2027-01-01" }], today });
    expect(p.status).toBe("no_data");
  });
});
