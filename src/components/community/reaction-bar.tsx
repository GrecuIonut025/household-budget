import clsx from "clsx";
import { Heart, Lightbulb, ThumbsUp } from "lucide-react";
import {
  toggleCommentReaction,
  toggleRecipeReaction,
} from "@/app/actions/community";
import type { RecipeReactionSummary } from "@/lib/data/community";
import { REACTION_KINDS, type ReactionKind } from "@/lib/community/reactions";
import type { Translate } from "@/lib/i18n";

const ICONS: Record<ReactionKind, typeof Heart> = {
  like: ThumbsUp,
  useful: Lightbulb,
  love: Heart,
};

export function ReactionBar({
  recipeId,
  commentId,
  summary,
  canReact,
  t,
  compact,
}: {
  recipeId: string;
  commentId?: string;
  summary: RecipeReactionSummary;
  canReact: boolean;
  t: Translate;
  compact?: boolean;
}) {
  const action = commentId ? toggleCommentReaction : toggleRecipeReaction;

  return (
    <div className={clsx("flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
      {REACTION_KINDS.map((kind) => {
        const Icon = ICONS[kind];
        const active = summary.mine.includes(kind);
        const count = summary.counts[kind];
        const label = t(`community.reaction.${kind}`);
        if (!canReact) {
          return (
            <span
              key={kind}
              title={label}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border border-border-soft bg-surface-2/60 px-2 py-1 text-[11px] text-muted",
                compact && "px-1.5 py-0.5",
                count === 0 && "opacity-50",
              )}
            >
              <Icon
                size={compact ? 12 : 14}
                aria-hidden
                fill={kind === "love" && active ? "currentColor" : "none"}
              />
              {count > 0 ? <span className="tabular">{count}</span> : null}
            </span>
          );
        }
        return (
          <form key={kind} action={action}>
            <input type="hidden" name="recipeId" value={recipeId} />
            {commentId ? <input type="hidden" name="commentId" value={commentId} /> : null}
            <input type="hidden" name="kind" value={kind} />
            <button
              type="submit"
              aria-label={label}
              aria-pressed={active}
              title={label}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition active:scale-95",
                compact && "px-1.5 py-0.5",
                active
                  ? "border-brand/40 bg-brand-soft text-brand-strong"
                  : "border-border-soft bg-surface text-muted hover:text-fg",
              )}
            >
              <Icon
                size={compact ? 12 : 14}
                aria-hidden
                fill={kind === "love" && active ? "currentColor" : "none"}
              />
              <span className="hidden sm:inline">{label}</span>
              {count > 0 ? <span className="tabular">{count}</span> : null}
            </button>
          </form>
        );
      })}
    </div>
  );
}
