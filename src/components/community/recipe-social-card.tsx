"use client";

import { useRef } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AuthorChip } from "@/components/community/author-chip";
import {
  InlineComments,
  type InlineCommentsHandle,
} from "@/components/community/inline-comments";
import { DoubleTapLove, PostActions } from "@/components/community/post-actions";
import { formatRelativeTime } from "@/lib/format";
import type { CommunityFeedItem } from "@/lib/data/community";
import { useI18n } from "@/lib/i18n/provider";

export function RecipeSocialCard({
  item,
  householdId,
  canFavorite,
  canReact,
  currentUserId,
}: {
  item: CommunityFeedItem;
  householdId: string;
  canFavorite: boolean;
  canReact: boolean;
  currentUserId: string;
  minutesLabel?: string | null;
  servingsLabel?: string;
  categoryLabel?: string | null;
  inlineComments?: boolean;
}) {
  const { t, locale } = useI18n();
  const ownHousehold = item.householdId === householdId;
  const commentsRef = useRef<InlineCommentsHandle | null>(null);
  const likes = item.reactions.total;

  return (
    <article className="border-b border-border-soft bg-bg pb-3">
      <header className="flex items-center gap-2 px-3 py-2.5">
        {item.author ? (
          <AuthorChip author={item.author} t={t} size="sm" className="min-w-0 flex-1" />
        ) : (
          <p className="flex-1 text-xs text-muted">{t("community.unknownAuthor")}</p>
        )}
        <time
          dateTime={item.communityPublishedAt}
          className="shrink-0 text-[11px] text-muted"
        >
          {formatRelativeTime(item.communityPublishedAt, locale)}
        </time>
      </header>

      <DoubleTapLove recipeId={item.id} canReact={canReact}>
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-2 sm:aspect-square">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="size-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-brand-soft to-surface-2 text-brand/45">
              <Sparkles size={48} aria-hidden />
            </div>
          )}
        </div>
      </DoubleTapLove>

      <PostActions
        recipeId={item.id}
        householdId={householdId}
        summary={item.reactions}
        canReact={canReact}
        canFavorite={canFavorite}
        isFavorite={item.isFavorite}
        ownHousehold={ownHousehold}
        commentCount={item.commentCount}
        onCommentClick={() => commentsRef.current?.open()}
      />

      {likes > 0 ? (
        <p className="px-4 pt-1 text-sm font-semibold text-fg">
          {t("community.likesCount", { count: likes })}
        </p>
      ) : null}

      <div className="space-y-1 px-4 pt-1.5">
        <p className="text-sm leading-snug text-fg">
          {item.author ? (
            <Link
              href={`/community/members/${item.author.id}`}
              className="font-semibold hover:opacity-80"
            >
              {item.author.displayName}{" "}
            </Link>
          ) : null}
          <span className="font-medium">{item.title}</span>
          {item.description ? (
            <span className="text-muted"> — {item.description}</span>
          ) : null}
        </p>
        <Link
          href={`/community/posts/${item.id}`}
          className="inline-block text-xs font-medium text-muted hover:text-fg"
        >
          {t("community.viewRecipe")}
        </Link>
      </div>

      <div className="px-3 pt-2">
        <InlineComments
          ref={commentsRef}
          recipeId={item.id}
          commentCount={item.commentCount}
          currentUserId={currentUserId}
          canWrite={canReact}
        />
      </div>
    </article>
  );
}
