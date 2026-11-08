"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { RecipeSocialCard } from "@/components/community/recipe-social-card";
import { StoriesStrip } from "@/components/community/stories-strip";
import { EmptyState, buttonClass } from "@/components/ui";
import type {
  CommunityAuthor,
  CommunityFeedItem,
  CommunityFeedPage,
} from "@/lib/data/community";
import { useI18n } from "@/lib/i18n/provider";

function uniqueAuthors(items: CommunityFeedItem[]): CommunityAuthor[] {
  const seen = new Set<string>();
  const out: CommunityAuthor[] = [];
  for (const item of items) {
    if (!item.author || seen.has(item.author.id)) continue;
    seen.add(item.author.id);
    out.push(item.author);
    if (out.length >= 12) break;
  }
  return out;
}

export function FeedInfinite({
  initial,
  householdId,
  canFavorite,
  canReact,
  currentUserId,
  emptyTitle,
  emptyBody,
  emptyAction,
}: {
  initial: CommunityFeedPage;
  householdId: string;
  canFavorite: boolean;
  canReact: boolean;
  currentUserId: string;
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const authors = uniqueAuthors(items);

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
      <div className="px-4 py-10">
        <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />
      </div>
    );
  }

  return (
    <div>
      <StoriesStrip authors={authors} t={t} />
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <RecipeSocialCard
              item={item}
              householdId={householdId}
              canFavorite={canFavorite}
              canReact={canReact}
              currentUserId={currentUserId}
            />
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-6">
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
