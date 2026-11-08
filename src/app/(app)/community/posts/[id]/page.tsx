import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AuthorChip } from "@/components/community/author-chip";
import { CommentThread } from "@/components/community/comment-thread";
import { PostActions } from "@/components/community/post-actions";
import { PostDetailClient } from "@/components/community/post-detail-client";
import { buttonClass } from "@/components/ui";
import { getCommunityPostSocial } from "@/lib/data/community";
import { requireAppContext } from "@/lib/data/context";
import { getImageUrls } from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import { getTranslator } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { t } = await getTranslator();
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { title: t("nav.community") };
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("title")
    .eq("id", parsed.data)
    .not("community_published_at", "is", null)
    .maybeSingle();
  return { title: data?.title ?? t("nav.community") };
}

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const ctx = await requireAppContext();
  const { t } = await getTranslator();
  const writer = canWrite(ctx.active.role);
  const supabase = await createClient();

  const { data } = await supabase
    .from("recipes")
    .select(
      "id, household_id, title, description, servings, prep_minutes, cook_minutes, category, tags, image_path, community_published_at, is_favorite",
    )
    .eq("id", parsed.data)
    .not("community_published_at", "is", null)
    .maybeSingle();
  if (!data) notFound();

  const social = await getCommunityPostSocial(parsed.data, ctx.user.id);
  const imageUrls = await getImageUrls([data.image_path as string | null]);
  const imageUrl = data.image_path
    ? (imageUrls[data.image_path as string] ?? null)
    : null;
  const ownHousehold = data.household_id === ctx.active.household.id;

  return (
    <div className="-mx-4 flex justify-center sm:-mx-6 md:mx-0">
      <article className="w-full max-w-[470px] border-border md:rounded-2xl md:border md:bg-surface md:shadow-card">
        <div className="flex items-center gap-2 border-b border-border-soft px-3 py-2.5">
          <Link
            href="/community"
            className="inline-flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2"
            aria-label={t("nav.community")}
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-sm font-bold">{t("community.viewRecipe")}</h1>
        </div>

        <header className="flex items-center gap-2 px-3 py-2.5">
          {social.author ? (
            <AuthorChip author={social.author} t={t} size="sm" className="min-w-0 flex-1" />
          ) : (
            <p className="flex-1 text-xs text-muted">{t("community.unknownAuthor")}</p>
          )}
        </header>

        <PostDetailClient
          recipeId={data.id as string}
          canReact={writer}
          imageUrl={imageUrl}
        />

        <PostActions
          recipeId={data.id as string}
          householdId={ctx.active.household.id}
          summary={social.reactions}
          canReact={writer}
          canFavorite={writer}
          isFavorite={Boolean(data.is_favorite)}
          ownHousehold={ownHousehold}
          commentCount={social.commentCount}
        />

        {social.reactions.total > 0 ? (
          <p className="px-4 pt-1 text-sm font-semibold text-fg">
            {t("community.likesCount", { count: social.reactions.total })}
          </p>
        ) : null}

        <div className="space-y-2 px-4 py-2">
          <p className="text-sm leading-snug text-fg">
            {social.author ? (
              <Link
                href={`/community/members/${social.author.id}`}
                className="font-semibold hover:opacity-80"
              >
                {social.author.displayName}{" "}
              </Link>
            ) : null}
            <span className="font-medium">{data.title as string}</span>
            {data.description ? (
              <span className="text-muted"> — {data.description as string}</span>
            ) : null}
          </p>
          {ownHousehold ? (
            <Link
              href={`/recipes/${data.id}`}
              className={buttonClass("secondary", "text-xs")}
            >
              {t("community.openFullRecipe")}
            </Link>
          ) : null}
        </div>

        <div className="border-t border-border-soft px-3 py-3">
          <CommentThread
            recipeId={data.id as string}
            comments={social.comments}
            currentUserId={ctx.user.id}
            canWrite={writer}
          />
        </div>
      </article>
    </div>
  );
}
