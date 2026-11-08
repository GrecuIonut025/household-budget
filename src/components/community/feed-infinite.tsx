"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { RecipeSocialCard } from "@/components/community/recipe-social-card";
import { EmptyState, buttonClass } from "@/components/ui";
import type { CommunityFeedItem, CommunityFeedPage } from "@/lib/data/community";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

function labelsFor(
  item: CommunityFeedItem,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): { minutes: string | null; servings: string; category: string | null } {
  const minutes = (item.prepMinutes ?? 0) + (item.cookMinutes ?? 0);
  return {
    minutes: minutes > 0 ? t("recipes.minutes", { count: minutes }) : null,
    servings: t("recipes.servingsCount", { count: item.servings }),
    category: item.category
      ? t(`recipes.category.${item.category}` as MessageKey)
      : null,
  };
}

export function FeedInfinite({
  initial,
  householdId,
  canFavorite,
  canReact,
  emptyTitle,
  emptyBody,
}: {
  initial: CommunityFeedPage;
  householdId: string;
  canFavorite: boolean;
  canReact: boolean;
  emptyTitle: string;
  emptyBody: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const qs = new URLSearchParams({
          cursorPublishedAt: cursor.publishedAt,
          cursorId: cursor.id,
        });
        const res = await fetch(`/api/community/feed?${qs.toString()}`, {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("load failed");
        const page = (await res.json()) as CommunityFeedPage;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
        });
        setCursor(page.nextCursor);
      } catch {
        setError(t("community.feed.error"));
      } finally {
        loadingRef.current = false;
      }
    });
  }, [cursor, t]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (items.length === 0) {
    return (
      <div className="dashboard-card p-5">
        <EmptyState title={emptyTitle} body={emptyBody} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const labels = labelsFor(item, t);
          return (
            <li key={item.id}>
              <RecipeSocialCard
                item={item}
                householdId={householdId}
                canFavorite={canFavorite}
                canReact={canReact}
                minutesLabel={labels.minutes}
                servingsLabel={labels.servings}
                categoryLabel={labels.category}
                t={t}
              />
            </li>
          );
        })}
      </ul>

      <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-4">
        {pending ? (
          <LoaderCircle className="size-5 animate-spin text-muted" aria-hidden />
        ) : null}
        {error ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-danger">{error}</p>
            <button type="button" className={buttonClass("secondary", "text-xs")} onClick={loadMore}>
              {t("community.feed.retry")}
            </button>
          </div>
        ) : null}
        {!cursor && !pending ? (
          <p className="text-xs text-muted">{t("community.feed.end")}</p>
        ) : null}
      </div>
    </div>
  );
}
