import Link from "next/link";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";
import { AuthorChip } from "@/components/community/author-chip";
import { GradeBadge } from "@/components/community/grade-badge";
import { ReactionBar } from "@/components/community/reaction-bar";
import { FavoriteButton } from "@/components/recipes/favorite-button";
import type { CommunityFeedItem } from "@/lib/data/community";
import type { Translate } from "@/lib/i18n";

export function RecipeSocialCard({
  item,
  householdId,
  canFavorite,
  canReact,
  minutesLabel,
  servingsLabel,
  categoryLabel,
  t,
  commentsHref,
}: {
  item: CommunityFeedItem;
  /** Active household — favorite only when the post belongs to it. */
  householdId: string;
  canFavorite: boolean;
  canReact: boolean;
  minutesLabel: string | null;
  servingsLabel: string;
  categoryLabel: string | null;
  t: Translate;
  commentsHref?: string;
}) {
  const ownHousehold = item.householdId === householdId;
  return (
    <article className="dashboard-card flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="size-full object-cover transition duration-500 hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-brand-soft to-surface-2 text-brand/50">
            <Sparkles size={36} aria-hidden />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {canFavorite && ownHousehold ? (
          <div className="absolute top-2 right-2">
            <FavoriteButton
              recipeId={item.id}
              householdId={householdId}
              isFavorite={item.isFavorite}
              label={item.isFavorite ? t("recipes.unfavorite") : t("recipes.favorite")}
              className="size-9 bg-black/35 text-white hover:text-pink-300"
            />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {item.author ? (
          <AuthorChip author={item.author} t={t} size="sm" />
        ) : (
          <p className="text-xs text-muted">{t("community.unknownAuthor")}</p>
        )}

        <h3 className="line-clamp-2 text-sm font-bold tracking-tight text-fg">{item.title}</h3>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted">
          {minutesLabel ? <span>{minutesLabel}</span> : null}
          <span>{servingsLabel}</span>
          {categoryLabel ? <span>{categoryLabel}</span> : null}
        </div>
        {item.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">{item.description}</p>
        ) : null}

        <ReactionBar
          recipeId={item.id}
          summary={item.reactions}
          canReact={canReact}
          t={t}
        />

        <Link
          href={commentsHref ?? `/community/posts/${item.id}`}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-border-soft bg-surface-2/40 px-3 py-2 text-xs font-medium text-muted transition hover:text-fg"
        >
          <MessageCircle size={14} aria-hidden />
          {t("community.showComments", { count: item.commentCount })}
        </Link>

        <div className="mt-auto flex items-center gap-2 border-t border-border-soft pt-3">
          <Link
            href={`/community/posts/${item.id}`}
            className="btn-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
          >
            {t("community.viewRecipe")}
            <ArrowRight size={14} aria-hidden />
          </Link>
          {item.author ? <GradeBadge grade={item.author.grade} t={t} /> : null}
        </div>
      </div>
    </article>
  );
}
