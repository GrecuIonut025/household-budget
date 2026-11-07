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
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {group.rows.map((tx) => {
                const category = tx.category_id ? categoryById.get(tx.category_id) : undefined;
                const who = tx.paid_by ? memberById.get(tx.paid_by) : undefined;
                const body = (
                  <>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">
                        {tx.description || (category ? categoryLabel(t, category) : t(tx.type === "income" ? "common.income" : "common.expense"))}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {category ? <span>{categoryLabel(t, category)}</span> : null}
                        {who ? <span>· {who}</span> : null}
                        {tx.scope === "individual" ? <Badge>{t("common.individual")}</Badge> : null}
                      </span>
                    </span>
                    <span className={clsx("tabular shrink-0 text-sm font-semibold", tx.type === "income" ? "text-ok" : "text-fg")}>
                      {tx.type === "income" ? "+" : "−"}
                      {formatMoney(toMinor(tx.amount), currency, locale)}
                    </span>
                  </>
                );
                return (
                  <li key={tx.id}>
                    {tx.editable ? (
                      <button type="button" onClick={() => setEditing(tx)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                        {body}
                      </button>
                    ) : (
                      <div className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5">{body}</div>
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
