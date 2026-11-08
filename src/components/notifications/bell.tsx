"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  Award,
  Bell,
  Heart,
  MessageCircle,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import { markNotificationsRead } from "@/app/actions/community";
import { formatRelativeTime } from "@/lib/format";
import type { NotificationRow } from "@/lib/data/community";
import type { Translate } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

const PANEL_WIDTH = 360;
const PANEL_MAX_H = 448;
const VIEW_PAD = 8;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
}

function metaFor(n: NotificationRow, t: Translate): {
  title: string;
  context: string;
  Icon: typeof Bell;
} {
  const actor = n.actorName ?? t("community.unknownAuthor");
  switch (n.kind) {
    case "reaction_love":
      return {
        title: t("community.notify.loveTitle"),
        context: t("community.notify.love", { name: actor }),
        Icon: Heart,
      };
    case "reaction_post":
      return {
        title: t("community.notify.reactionPostTitle"),
        context: t("community.notify.reactionPost", { name: actor }),
        Icon: ThumbsUp,
      };
    case "reaction_comment":
      return {
        title: t("community.notify.reactionCommentTitle"),
        context: t("community.notify.reactionComment", { name: actor }),
        Icon: ThumbsUp,
      };
    case "comment_reply":
      return {
        title: t("community.notify.replyTitle"),
        context: t("community.notify.reply", { name: actor }),
        Icon: MessageCircle,
      };
    case "grade_up": {
      const grade = typeof n.payload.grade === "number" ? n.payload.grade : 1;
      return {
        title: t("community.notify.gradeUpTitle"),
        context: t("community.notify.gradeUp", { grade }),
        Icon: Award,
      };
    }
    case "first_publish":
      return {
        title: t("community.notify.firstPublishTitle"),
        context: t("community.notify.firstPublish"),
        Icon: Sparkles,
      };
    default:
      return {
        title: t("community.notify.generic"),
        context: t("community.notify.generic"),
        Icon: Bell,
      };
  }
}

function useIsMobileSheet(): boolean {
  const get = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

/** Keep a fixed panel fully inside the viewport, anchored to the trigger. */
function positionDesktopPanel(trigger: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, vw - VIEW_PAD * 2);
  const maxHeight = Math.min(PANEL_MAX_H, vh - VIEW_PAD * 2);

  // Sidebar (left half): grow right from the trigger. Header (right): grow left.
  const preferLeftAlign = trigger.left < vw / 2;
  let left = preferLeftAlign ? trigger.left : trigger.right - width;
  left = Math.max(VIEW_PAD, Math.min(left, vw - width - VIEW_PAD));

  const gap = 8;
  const spaceBelow = vh - trigger.bottom - gap - VIEW_PAD;
  const spaceAbove = trigger.top - gap - VIEW_PAD;
  const openUp = spaceBelow < Math.min(280, maxHeight) && spaceAbove > spaceBelow;

  let top: number;
  let maxH: number;
  if (openUp) {
    maxH = Math.min(maxHeight, Math.max(160, spaceAbove));
    top = Math.max(VIEW_PAD, trigger.top - gap - maxH);
  } else {
    maxH = Math.min(maxHeight, Math.max(160, spaceBelow));
    top = Math.min(trigger.bottom + gap, vh - VIEW_PAD - Math.min(maxH, spaceBelow));
  }

  return {
    position: "fixed",
    top,
    left,
    width,
    maxHeight: maxH,
    zIndex: 200,
  };
}

export function NotificationsBell({
  items,
  unreadCount,
  compact,
}: {
  items: NotificationRow[];
  unreadCount: number;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mobile = useIsMobileSheet();
  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!open || mobile) return;
    const el = triggerRef.current;
    if (!el) return;
    setPanelStyle(positionDesktopPanel(el.getBoundingClientRect()));
  }, [open, mobile]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    if (!open || mobile) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, mobile, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, mobile]);

  const panel = open && mounted ? (
    <>
      {mobile ? (
        <button
          type="button"
          aria-label={t("common.close")}
          className="fixed inset-0 z-[200] bg-black/40"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal={mobile ? true : undefined}
        aria-label={t("dashboard.notifications")}
        className={
          mobile
            ? "fixed inset-x-0 bottom-0 z-[210] flex max-h-[min(85dvh,36rem)] flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-[var(--shadow-card)]"
            : "fixed z-[210] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]"
        }
        style={
          mobile
            ? { paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }
            : panelStyle
        }
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{t("dashboard.notifications")}</p>
            {unreadCount > 0 ? (
              <p className="text-[11px] text-muted">
                {t("community.notify.unreadCount", { count: unreadCount })}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {unreadCount > 0 ? (
              <form action={markNotificationsRead}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-brand hover:bg-brand-soft"
                >
                  {t("community.notify.markAllRead")}
                </button>
              </form>
            ) : null}
            <button
              type="button"
              className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg md:hidden"
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {t("dashboard.notificationsEmpty")}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-2">
            {items.map((n) => {
              const href = n.recipeId ? `/community/posts/${n.recipeId}` : "/community";
              const { title, context, Icon } = metaFor(n, t);
              const actor = n.actorName ?? t("community.unknownAuthor");
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex gap-3 rounded-2xl px-2.5 py-2.5 transition hover:bg-surface-2 ${
                      n.readAt ? "opacity-80" : "bg-brand-soft/35"
                    }`}
                  >
                    <span className="relative mt-0.5 grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-xs font-semibold text-fg">
                      {n.actorAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.actorAvatarUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : n.actorId ? (
                        initials(actor)
                      ) : (
                        <Icon size={16} className="text-brand" aria-hidden />
                      )}
                      <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border border-surface bg-brand text-white">
                        <Icon size={10} aria-hidden />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-fg">{title}</span>
                        <time
                          dateTime={n.createdAt}
                          className="shrink-0 text-[11px] text-muted"
                        >
                          {formatRelativeTime(n.createdAt, locale)}
                        </time>
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                        {context}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  ) : null;

  return (
    <div className="relative z-10">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("dashboard.notifications")}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "relative flex size-10 touch-manipulation items-center justify-center rounded-2xl text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg"
            : "relative flex size-10 touch-manipulation items-center justify-center rounded-2xl border border-border bg-surface text-muted transition hover:border-muted hover:text-fg"
        }
      >
        <Bell size={18} aria-hidden />
        {badge ? (
          <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-5 text-white">
            {badge}
          </span>
        ) : null}
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
