"use client";

import { useCallback, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, LoaderCircle, MessageCircle } from "lucide-react";
import { CommentThread } from "@/components/community/comment-thread";
import { buttonClass } from "@/components/ui";
import type { CommunityComment, CommunityRecipeSocial } from "@/lib/data/community";
import { useI18n } from "@/lib/i18n/provider";

export function InlineComments({
  recipeId,
  commentCount,
  currentUserId,
  canWrite,
}: {
  recipeId: string;
  commentCount: number;
  currentUserId: string;
  canWrite: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(commentCount);
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/community/posts/${recipeId}/social`, {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("load failed");
        const social = (await res.json()) as CommunityRecipeSocial;
        setComments(social.comments);
        setCount(social.commentCount);
      } catch {
        setError(t("community.comments.loadError"));
      }
    });
  }, [recipeId, t]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && comments === null && !pending) load();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex w-full items-center justify-between gap-1.5 rounded-2xl border border-border-soft bg-surface-2/40 px-3 py-2 text-xs font-medium text-muted transition hover:text-fg"
      >
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle size={14} aria-hidden />
          {open
            ? t("community.hideComments")
            : t("community.showComments", { count })}
        </span>
        {open ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      </button>

      {open ? (
        <div className="rounded-2xl border border-border-soft bg-surface/80 p-3 sm:p-3.5">
          {pending && comments === null ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
              <LoaderCircle size={16} className="animate-spin" aria-hidden />
              {t("community.comments.loading")}
            </div>
          ) : null}
          {error ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-sm text-danger">{error}</p>
              <button type="button" className={buttonClass("secondary", "text-xs")} onClick={load}>
                {t("community.feed.retry")}
              </button>
            </div>
          ) : null}
          {comments ? (
            <CommentThread
              recipeId={recipeId}
              comments={comments}
              currentUserId={currentUserId}
              canWrite={canWrite}
              compact
              onPosted={load}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
