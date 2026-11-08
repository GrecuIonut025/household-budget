"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import clsx from "clsx";
import { Bookmark, Heart, Lightbulb, MessageCircle, ThumbsUp } from "lucide-react";
import { toggleRecipeReaction } from "@/app/actions/community";
import { toggleFavorite } from "@/app/actions/recipes";
import type { RecipeReactionSummary } from "@/lib/data/community";
import type { ReactionKind } from "@/lib/community/reactions";
import { useI18n } from "@/lib/i18n/provider";

/** Instagram-style action row: heart + comment + bookmark; extra reactions stay secondary. */
export function PostActions({
  recipeId,
  householdId,
  summary,
  canReact,
  canFavorite,
  isFavorite,
  ownHousehold,
  commentCount,
  onCommentClick,
}: {
  recipeId: string;
  householdId: string;
  summary: RecipeReactionSummary;
  canReact: boolean;
  canFavorite: boolean;
  isFavorite: boolean;
  ownHousehold: boolean;
  commentCount: number;
  onCommentClick?: () => void;
}) {
  const { t } = useI18n();
  const loved = summary.mine.includes("love");
  const liked = summary.mine.includes("like");
  const useful = summary.mine.includes("useful");
  const [, startTransition] = useTransition();

  function toggle(kind: ReactionKind) {
    if (!canReact) return;
    const fd = new FormData();
    fd.set("recipeId", recipeId);
    fd.set("kind", kind);
    startTransition(async () => {
      await toggleRecipeReaction(fd);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 px-2 pt-1.5">
        <form action={toggleRecipeReaction} className="contents">
          <input type="hidden" name="recipeId" value={recipeId} />
          <input type="hidden" name="kind" value="love" />
          <button
            type="submit"
            disabled={!canReact}
            aria-label={t("community.reaction.love")}
            aria-pressed={loved}
            className={clsx(
              "grid size-11 place-items-center rounded-full transition active:scale-90",
              loved ? "text-brand-coral" : "text-fg hover:opacity-70",
              !canReact && "opacity-50",
            )}
          >
            <Heart
              size={26}
              aria-hidden
              fill={loved ? "currentColor" : "none"}
              strokeWidth={1.75}
            />
          </button>
        </form>

        <button
          type="button"
          onClick={onCommentClick}
          aria-label={t("community.commentsTitle")}
          className="grid size-11 place-items-center rounded-full text-fg transition hover:opacity-70 active:scale-90"
        >
          <MessageCircle size={26} aria-hidden strokeWidth={1.75} />
          {commentCount > 0 ? (
            <span className="sr-only">
              {t("community.showComments", { count: commentCount })}
            </span>
          ) : null}
        </button>

        <div className="ml-auto">
          {canFavorite && ownHousehold ? (
            <form action={toggleFavorite}>
              <input type="hidden" name="id" value={recipeId} />
              <input type="hidden" name="householdId" value={householdId} />
              <input type="hidden" name="favorite" value={String(!isFavorite)} />
              <button
                type="submit"
                aria-label={isFavorite ? t("recipes.unfavorite") : t("recipes.favorite")}
                aria-pressed={isFavorite}
                className="grid size-11 place-items-center rounded-full text-fg transition hover:opacity-70 active:scale-90"
              >
                <Bookmark
                  size={26}
                  aria-hidden
                  fill={isFavorite ? "currentColor" : "none"}
                  strokeWidth={1.75}
                />
              </button>
            </form>
          ) : (
            <span className="grid size-11 place-items-center text-transparent" aria-hidden>
              <Bookmark size={26} />
            </span>
          )}
        </div>
      </div>

      {canReact ? (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-0.5">
          <button
            type="button"
            onClick={() => toggle("like")}
            aria-pressed={liked}
            className={clsx(
              "inline-flex items-center gap-1 text-[11px] font-semibold transition",
              liked ? "text-brand" : "text-muted hover:text-fg",
            )}
          >
            <ThumbsUp size={12} aria-hidden fill={liked ? "currentColor" : "none"} />
            {t("community.reaction.like")}
            {summary.counts.like > 0 ? (
              <span className="tabular font-normal">{summary.counts.like}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => toggle("useful")}
            aria-pressed={useful}
            className={clsx(
              "inline-flex items-center gap-1 text-[11px] font-semibold transition",
              useful ? "text-brand-amber" : "text-muted hover:text-fg",
            )}
          >
            <Lightbulb size={12} aria-hidden fill={useful ? "currentColor" : "none"} />
            {t("community.reaction.useful")}
            {summary.counts.useful > 0 ? (
              <span className="tabular font-normal">{summary.counts.useful}</span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Double-tap on media to love — Instagram interaction. */
export function DoubleTapLove({
  recipeId,
  canReact,
  children,
}: {
  recipeId: string;
  canReact: boolean;
  children: ReactNode;
}) {
  const lastTap = useRef(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [burst, setBurst] = useState(false);

  function onPointerUp() {
    if (!canReact) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setBurst(true);
      formRef.current?.requestSubmit();
      window.setTimeout(() => setBurst(false), 700);
    } else {
      lastTap.current = now;
    }
  }

  return (
    <div className="relative select-none" onPointerUp={onPointerUp}>
      {children}
      <form ref={formRef} action={toggleRecipeReaction} className="hidden">
        <input type="hidden" name="recipeId" value={recipeId} />
        <input type="hidden" name="kind" value="love" />
        <button type="submit" tabIndex={-1} aria-hidden />
      </form>
      {burst ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <Heart
            size={88}
            className="animate-ig-heart text-white drop-shadow-lg"
            fill="currentColor"
            aria-hidden
          />
        </span>
      ) : null}
    </div>
  );
}
