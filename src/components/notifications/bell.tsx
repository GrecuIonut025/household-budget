import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/app/actions/community";
import type { NotificationRow } from "@/lib/data/community";
import type { Translate } from "@/lib/i18n";

function labelFor(n: NotificationRow, t: Translate): string {
  const actor = n.actorName ?? t("community.unknownAuthor");
  switch (n.kind) {
    case "reaction_love":
      return t("community.notify.love", { name: actor });
    case "reaction_post":
      return t("community.notify.reactionPost", { name: actor });
    case "reaction_comment":
      return t("community.notify.reactionComment", { name: actor });
    case "comment_reply":
      return t("community.notify.reply", { name: actor });
    case "grade_up": {
      const grade = typeof n.payload.grade === "number" ? n.payload.grade : 1;
      return t("community.notify.gradeUp", { grade });
    }
    case "first_publish":
      return t("community.notify.firstPublish");
    default:
      return t("community.notify.generic");
  }
}

export function NotificationsBell({
  items,
  unreadCount,
  t,
  compact,
}: {
  items: NotificationRow[];
  unreadCount: number;
  t: Translate;
  compact?: boolean;
}) {
  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <details className="relative">
      <summary
        className={
          compact
            ? "relative flex size-10 list-none items-center justify-center rounded-2xl text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg marker:content-none [&::-webkit-details-marker]:hidden"
            : "relative flex size-10 list-none items-center justify-center rounded-2xl border border-border bg-surface text-muted transition hover:border-muted hover:text-fg marker:content-none [&::-webkit-details-marker]:hidden"
        }
        aria-label={t("dashboard.notifications")}
      >
        <Bell size={18} aria-hidden />
        {badge ? (
          <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-5 text-white">
            {badge}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,20rem)] rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center justify-between gap-2 px-2 pt-1">
          <p className="text-xs font-semibold text-fg">{t("dashboard.notifications")}</p>
          {unreadCount > 0 ? (
            <form action={markNotificationsRead}>
              <button type="submit" className="text-[11px] font-medium text-brand hover:underline">
                {t("community.notify.markAllRead")}
              </button>
            </form>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted">{t("dashboard.notificationsEmpty")}</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain">
            {items.map((n) => {
              const href = n.recipeId ? `/community/posts/${n.recipeId}` : "/community";
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    className={`block rounded-xl px-2.5 py-2 text-sm transition hover:bg-surface-2 ${
                      n.readAt ? "text-muted" : "bg-brand-soft/40 font-medium text-fg"
                    }`}
                  >
                    <span className="line-clamp-3">{labelFor(n, t)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
