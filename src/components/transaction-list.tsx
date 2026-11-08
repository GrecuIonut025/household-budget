"use client";

import clsx from "clsx";
import { useState } from "react";
import { formatDateLong } from "@/lib/format";
import { formatMoney, toMinor } from "@/lib/money";
import { categoryLabel } from "@/lib/i18n/category";
import { useI18n } from "@/lib/i18n/provider";
import type { CategoryRow, MemberRow, TransactionRow } from "@/lib/data/types";
import { TransactionSheet } from "./transaction-form";
import { Badge } from "./ui";

export interface TransactionListProps {
  householdId: string;
  currency: string;
  transactions: (TransactionRow & { editable: boolean })[];
  categories: CategoryRow[];
  members: MemberRow[];
  currentUserId: string;
  today: string;
  /** group rows under date headings */
  grouped?: boolean;
}

export function TransactionList({ transactions, categories, members, currency, grouped = true, ...rest }: TransactionListProps) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const memberById = new Map(members.map((m) => [m.user_id, m.display_name]));

  const groups: { date: string; rows: typeof transactions }[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (grouped && last && last.date === tx.occurred_on) last.rows.push(tx);
    else groups.push({ date: tx.occurred_on, rows: [tx] });
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.rows[0].id}>
            {grouped ? (
              <h3 className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted">
                {group.date === rest.today ? t("common.today") : formatDateLong(group.date, locale)}
              </h3>
            ) : null}
            <ul
              className={clsx(
                grouped
                  ? "divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
                  : "flex flex-col gap-2.5",
              )}
            >
              {group.rows.map((tx) => {
                const category = tx.category_id ? categoryById.get(tx.category_id) : undefined;
                const who = tx.paid_by ? memberById.get(tx.paid_by) : undefined;
                const body = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-bg text-xs font-semibold text-brand-accent shadow-inner sm:size-10">
                      {(tx.description || (category ? categoryLabel(t, category) : "?")).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className={clsx("block truncate font-semibold", grouped ? "text-sm" : "text-xs")}>
                        {tx.description || (category ? categoryLabel(t, category) : t(tx.type === "income" ? "common.income" : "common.expense"))}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        {category ? <span className="max-w-[10rem] truncate sm:max-w-none">{categoryLabel(t, category)}</span> : null}
                        {who ? <span className="max-w-[7rem] truncate sm:max-w-none">· {who}</span> : null}
                        {tx.scope === "individual" ? <Badge>{t("common.individual")}</Badge> : null}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        "tabular shrink-0 text-right font-bold",
                        grouped ? "text-sm" : "text-xs",
                        tx.type === "income" ? "text-ok" : "text-fg",
                      )}
                    >
                      {tx.type === "income" ? "+" : "−"}
                      {formatMoney(toMinor(tx.amount), currency, locale)}
                    </span>
                  </>
                );
                const rowClass = grouped
                  ? "flex min-h-14 w-full min-w-0 items-center gap-2.5 px-3 py-2.5 hover:bg-surface-2 sm:gap-3 sm:px-4"
                  : "flex w-full min-w-0 items-center justify-between gap-2.5 rounded-2xl border border-border-soft bg-surface-2/80 p-2.5 transition-all hover:bg-surface-hover sm:gap-3";
                return (
                  <li key={tx.id}>
                    {tx.editable ? (
                      <button type="button" onClick={() => setEditing(tx)} className={rowClass}>
                        {body}
                      </button>
                    ) : (
                      <div className={rowClass}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <TransactionSheet
        {...rest}
        categories={categories}
        members={members}
        transaction={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
