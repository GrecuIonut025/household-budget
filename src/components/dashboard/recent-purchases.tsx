import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Bus,
  Fuel,
  HeartPulse,
  Home,
  ShoppingBasket,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { formatMoney, toMinor } from "@/lib/money";
import { categoryLabel } from "@/lib/i18n/category";
import type { Translate } from "@/lib/i18n";
import type { CategoryRow, TransactionRow } from "@/lib/data/types";

function iconForCategory(cat: CategoryRow | undefined): LucideIcon {
  const key = (cat?.system_key ?? cat?.name ?? "").toLowerCase();
  if (key.includes("groc") || key.includes("aliment") || key.includes("food")) return ShoppingCart;
  if (key.includes("transport") || key.includes("fuel") || key.includes("gaz") || key.includes("carbur")) return Fuel;
  if (key.includes("rent") || key.includes("chir") || key.includes("util") || key.includes("house") || key.includes("cas"))
    return Home;
  if (key.includes("health") || key.includes("sanat") || key.includes("fitness") || key.includes("medic"))
    return HeartPulse;
  if (key.includes("salary") || key.includes("salari") || key.includes("income") || key.includes("venit"))
    return Banknote;
  if (key.includes("bus") || key.includes("travel")) return Bus;
  if (key.includes("shop") || key.includes("cumpar")) return ShoppingBasket;
  return Wallet;
}

export function RecentPurchases({
  title,
  viewAll,
  emptyTitle,
  emptyBody,
  transactions,
  categories,
  currency,
  locale,
  t,
  today,
}: {
  title: string;
  viewAll: string;
  emptyTitle: string;
  emptyBody: string;
  transactions: TransactionRow[];
  categories: CategoryRow[];
  currency: string;
  locale: string;
  t: Translate;
  today: string;
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <section className="flex min-h-[18rem] flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
        >
          {viewAll} <ArrowRight size={12} aria-hidden />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <ul className="flex-1 divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex min-h-14 items-center gap-3 py-2.5">
              <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-muted">
                <ShoppingBasket size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-1.5 block h-3.5 w-2/3 rounded bg-surface-2" />
                <span className="block h-2.5 w-1/3 rounded bg-surface-2/80" />
              </span>
              <span className="h-3.5 w-14 rounded bg-surface-2" />
            </li>
          ))}
          <li className="pt-3 text-center text-xs text-muted">
            {emptyTitle}
            {emptyBody ? <span className="mt-1 block text-muted/80">{emptyBody}</span> : null}
          </li>
        </ul>
      ) : (
        <ul className="flex-1 divide-y divide-border">
          {transactions.map((tx) => {
            const cat = tx.category_id ? byId.get(tx.category_id) : undefined;
            const Icon = iconForCategory(cat);
            const label =
              tx.description ||
              (cat ? categoryLabel(t, cat) : t(tx.type === "income" ? "common.income" : "common.expense"));
            return (
              <li key={tx.id} className="flex min-h-14 items-center gap-3 py-2.5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-brand">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {tx.occurred_on === today ? t("common.today") : formatDateLong(tx.occurred_on, locale)}
                    {cat ? ` · ${categoryLabel(t, cat)}` : ""}
                  </span>
                </span>
                <span
                  className={`tabular shrink-0 text-sm font-semibold ${
                    tx.type === "income" ? "text-ok" : "text-danger"
                  }`}
                >
                  {tx.type === "income" ? "+" : "−"}
                  {formatMoney(toMinor(tx.amount), currency, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
