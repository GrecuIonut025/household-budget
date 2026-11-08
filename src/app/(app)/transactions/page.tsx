import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { AddTransactionButton } from "@/components/transaction-form";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionList } from "@/components/transaction-list";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { getCategories, getTransactionsBetween } from "@/lib/data/budget";
import { getMembers, requireAppContext } from "@/lib/data/context";
import { canWrite, isAdmin } from "@/lib/data/types";
import { currentMonth, isValidMonth, monthRange, shiftMonth } from "@/lib/dates";
import { formatMonthLabel, todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.transactions") };
}

type Search = { month?: string; type?: string; category?: string; member?: string; scope?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const today = todayFor(household.timezone);
  const month = isValidMonth(params.month) ? params.month : currentMonth(today);
  const { start, end } = monthRange(month);
  const money = (minor: number) => formatMoney(minor, household.currency, locale);

  const [rows, categories, members] = await Promise.all([
    getTransactionsBetween(household.id, start, end),
    getCategories(household.id),
    getMembers(household.id),
  ]);

  const filters = {
    month,
    type: params.type === "income" || params.type === "expense" ? params.type : "",
    category: params.category ?? "",
    member: params.member ?? "",
    scope: params.scope === "shared" || params.scope === "individual" ? params.scope : "",
  };
  const filtered = rows.filter(
    (r) =>
      (!filters.type || r.type === filters.type) &&
      (!filters.category || r.category_id === filters.category) &&
      (!filters.member || r.paid_by === filters.member) &&
      (!filters.scope || r.scope === filters.scope),
  );

  const income = filtered.filter((r) => r.type === "income").reduce((s, r) => s + toMinor(r.amount), 0);
  const expenses = filtered.filter((r) => r.type === "expense").reduce((s, r) => s + toMinor(r.amount), 0);

  const writer = canWrite(role);
  const admin = isAdmin(role);
  const monthHref = (m: string) => {
    const q = new URLSearchParams({ ...(filters.type && { type: filters.type }), ...(filters.category && { category: filters.category }), ...(filters.member && { member: filters.member }), ...(filters.scope && { scope: filters.scope }), month: m });
    return `/transactions?${q.toString()}`;
  };
  const navLink = "grid size-11 place-items-center rounded-full border border-border bg-surface hover:bg-surface-2";

  const formProps = { householdId: household.id, categories, members, currentUserId: ctx.user.id, today };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <PageHeader title={t("tx.title")} action={writer ? <AddTransactionButton label={t("tx.add")} {...formProps} /> : undefined} />

      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <Link href={monthHref(shiftMonth(month, -1))} className={navLink} aria-label={t("tx.prevMonth")}>
          <ChevronLeft size={20} aria-hidden />
        </Link>
        <p className="min-w-0 truncate text-center text-sm font-semibold capitalize sm:text-base">
          {formatMonthLabel(month, locale)}
        </p>
        <Link href={monthHref(shiftMonth(month, 1))} className={navLink} aria-label={t("tx.nextMonth")}>
          <ChevronRight size={20} aria-hidden />
        </Link>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
          <Stat label={t("tx.summaryIncome")} value={money(income)} tone="ok" size="sm" />
          <Stat label={t("tx.summaryExpenses")} value={money(expenses)} size="sm" />
          <Stat
            label={t("tx.summaryNet")}
            value={money(income - expenses)}
            tone={income - expenses < 0 ? "danger" : "default"}
            size="sm"
          />
        </div>
      </Card>

      <TransactionFilters values={filters} categories={categories} members={members} />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt size={28} aria-hidden />}
            title={rows.length === 0 ? t("tx.emptyTitle") : t("tx.emptyFiltered")}
            body={rows.length === 0 ? t("tx.emptyBody") : undefined}
            action={rows.length === 0 && writer ? <AddTransactionButton label={t("tx.add")} {...formProps} /> : undefined}
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
          transactions={filtered.map((tx) => ({ ...tx, editable: admin || (writer && tx.created_by === ctx.user.id) }))}
        />
      )}
      {!writer ? <p className="text-center text-xs text-muted">{t("common.viewOnly")}</p> : null}
    </div>
  );
}
