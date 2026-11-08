import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChefHat, ChevronLeft, Clock, Users } from "lucide-react";
import { AuthorChip } from "@/components/community/author-chip";
import { CommentThread } from "@/components/community/comment-thread";
import { ReactionBar } from "@/components/community/reaction-bar";
import { Badge, Card, buttonClass } from "@/components/ui";
import { getCommunityPostSocial } from "@/lib/data/community";
import { requireAppContext } from "@/lib/data/context";
import { getImageUrls } from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import type { MessageKey } from "@/lib/i18n";
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
      "id, household_id, title, description, servings, prep_minutes, cook_minutes, category, tags, image_path, community_published_at",
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
  const minutes = (Number(data.prep_minutes) || 0) + (Number(data.cook_minutes) || 0);
  const ownHousehold = data.household_id === ctx.active.household.id;
  const category = data.category as string | null;

  return (
    <article className="space-y-4">
      <Link
        href="/community"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-fg"
      >
        <ChevronLeft size={18} aria-hidden />
        {t("nav.community")}
      </Link>

      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-brand-soft to-surface-2 sm:aspect-[21/9]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-brand/60">
              <ChefHat size={56} aria-hidden />
            </div>
          )}
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            {data.title as string}
          </h1>
          {social.author ? (
            <AuthorChip author={social.author} t={t} />
          ) : (
            <p className="text-xs text-muted">{t("community.unknownAuthor")}</p>
          )}
          <ReactionBar
            recipeId={data.id as string}
            summary={social.reactions}
            canReact={writer}
            t={t}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users size={16} aria-hidden />
              {t("recipes.servingsCount", { count: Number(data.servings) })}
            </span>
            {minutes > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} aria-hidden />
                {t("recipes.minutes", { count: minutes })}
              </span>
            ) : null}
          </div>
          {category ? (
            <Badge tone="brand">{t(`recipes.category.${category}` as MessageKey)}</Badge>
          ) : null}
          {data.description ? (
            <p className="text-sm leading-relaxed text-muted">{data.description as string}</p>
          ) : null}
          {ownHousehold ? (
            <Link
              href={`/recipes/${data.id}`}
              className={buttonClass("secondary", "text-xs")}
            >
              {t("community.openFullRecipe")}
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <CommentThread
          recipeId={data.id as string}
          comments={social.comments}
          currentUserId={ctx.user.id}
          canWrite={writer}
        />
      </Card>
    </article>
  );
}
