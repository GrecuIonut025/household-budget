import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function QuickLists({
  title,
  viewAll,
  emptyTitle,
  addLabel,
  lists,
  canAdd,
}: {
  title: string;
  viewAll: string;
  emptyTitle: string;
  addLabel: string;
  lists: { id: string; name: string; checked_count: number; item_count: number }[];
  canAdd: boolean;
}) {
  return (
    <section className="dashboard-card flex min-h-[18rem] flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-amber-400" aria-hidden>
            ★
          </span>
          <h2 className="text-base font-semibold text-fg">{title}</h2>
        </div>
        <Link
          href="/shopping-lists"
          className="inline-flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300"
        >
          {viewAll} <ArrowRight size={12} aria-hidden />
        </Link>
      </div>

      {lists.length === 0 ? (
        <ul className="flex-1 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex min-h-10 items-center gap-3 px-1">
              <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />
              <span className="h-3 flex-1 rounded bg-surface-2" />
            </li>
          ))}
          <li className="pt-2 text-center text-xs text-muted">{emptyTitle}</li>
        </ul>
      ) : (
        <ul className="flex-1 space-y-1.5">
          {lists.slice(0, 5).map((list) => (
            <li key={list.id}>
              <Link
                href={`/shopping-lists/${list.id}`}
                className="flex min-h-10 items-center gap-3 rounded-[var(--radius-md)] px-1 py-1.5 hover:bg-surface-2"
              >
                <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{list.name}</span>
                  <span className="text-xs text-muted">
                    {list.checked_count}/{list.item_count}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <Link href="/shopping-lists" className={buttonClass("primary", "mt-4 w-full justify-center")}>
          <Plus size={16} aria-hidden /> {addLabel}
        </Link>
      ) : null}
    </section>
  );
}
