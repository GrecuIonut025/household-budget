"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  useTransition,
} from "react";
import { LoaderCircle } from "lucide-react";
import { CommentThread } from "@/components/community/comment-thread";
import { buttonClass } from "@/components/ui";
import type { CommunityComment, CommunityRecipeSocial } from "@/lib/data/community";
import { useI18n } from "@/lib/i18n/provider";

export type InlineCommentsHandle = {
  open: () => void;
};

export const InlineComments = forwardRef<
  InlineCommentsHandle,
  {
    recipeId: string;
    commentCount: number;
    currentUserId: string;
    canWrite: boolean;
  }
>(function InlineComments(
  { recipeId, commentCount, currentUserId, canWrite },
  ref,
) {
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

  const openComments = useCallback(() => {
    setOpen(true);
    if (comments === null && !pending) load();
  }, [comments, load, pending]);

  useImperativeHandle(ref, () => ({ open: openComments }), [openComments]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    openComments();
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={false}
          className="w-full px-1 py-1 text-left text-sm text-muted transition hover:text-fg"
        >
          {count > 0
            ? t("community.viewAllComments", { count })
            : canWrite
              ? t("community.comment.add")
              : t("community.commentsEmptyTitle")}
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-expanded
          className="w-full px-1 py-0.5 text-left text-xs font-medium text-muted hover:text-fg"
        >
          {t("community.hideComments")}
        </button>
      )}

      {open ? (
        <div className="space-y-2 pb-1">
          {pending && comments === null ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
              <LoaderCircle size={16} className="animate-spin" aria-hidden />
              {t("community.comments.loading")}
            </div>
          ) : null}
          {error ? (
            <div className="flex flex-col items-center gap-2 py-3">
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
});
