import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChefHat,
  ChevronLeft,
  Clock,
  ExternalLink,
  Pencil,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import {
  publishRecipeToCommunity,
  unpublishRecipeFromCommunity,
} from "@/app/actions/community";
import { deleteRecipe } from "@/app/actions/recipes";
import { AuthorChip } from "@/components/community/author-chip";
import { CommentThread } from "@/components/community/comment-thread";
import { ReactionBar } from "@/components/community/reaction-bar";
import { ConfirmForm } from "@/components/confirm-form";
import { FavoriteButton } from "@/components/recipes/favorite-button";
import { RecipeCostPanel } from "@/components/recipes/recipe-cost-panel";
import { Badge, Card, CardTitle, buttonClass } from "@/components/ui";
import { getCommunityPostSocial } from "@/lib/data/community";
import { requireAppContext } from "@/lib/data/context";
import {
  createSupabasePricingLookup,
  getImageUrls,
  getPantryStock,
  getRecipe,
} from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import { todayFor } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n/server";
import { lookupPricing } from "@/lib/recipes/pricing";
import { formatQuantity } from "@/lib/recipes/scaling";
import { toCostIngredients } from "@/lib/recipes/types";
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
  const ctx = await requireAppContext();
  const parsed = z.uuid().safeParse(id);
  const recipe = parsed.success
    ? await getRecipe(ctx.active.household.id, parsed.data)
    : null;
  return { title: recipe?.title ?? t("nav.recipes") };
}

export default async function RecipePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();

  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);

  const recipe = await getRecipe(household.id, parsed.data);
  if (!recipe) notFound();

  const supabase = await createClient();
  const { data: pub } = await supabase
    .from("recipes")
    .select("community_published_at, created_by")
    .eq("id", recipe.id)
    .eq("household_id", household.id)
    .maybeSingle();
  const publishedAt = (pub?.community_published_at as string | null) ?? null;

  const productIds = [
    ...recipe.ingredients.flatMap((i) => [
      i.product_id,
      ...i.substitutions.map((s) => s.product_id),
    ]),
  ].filter((p): p is string => !!p);
  const lookup = await createSupabasePricingLookup({
    householdId: household.id,
    currency: household.currency,
    today: todayFor(household.timezone),
  });
  const [pricing, pantry, imageUrls, social] = await Promise.all([
    lookupPricing(lookup, productIds),
    getPantryStock(household.id, productIds),
    getImageUrls([recipe.image_path]),
    publishedAt
      ? getCommunityPostSocial(recipe.id, ctx.user.id)
      : Promise.resolve(null),
  ]);
  const imageUrl = recipe.image_path ? (imageUrls[recipe.image_path] ?? null) : null;
  const steps = (recipe.instructions ?? "")
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <article className="space-y-4">
      <Link
        href="/recipes"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted hover:text-fg"
      >
        <ChevronLeft size={18} aria-hidden />
        {t("nav.recipes")}
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
          {writer ? (
            <div className="absolute right-3 top-3">
              <FavoriteButton
                recipeId={recipe.id}
                householdId={household.id}
                isFavorite={recipe.is_favorite}
                label={recipe.is_favorite ? t("recipes.unfavorite") : t("recipes.favorite")}
              />
            </div>
          ) : null}
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {recipe.title}
            </h1>
          </div>
          {social?.author ? <AuthorChip author={social.author} t={t} /> : null}
          {social ? (
            <ReactionBar
              recipeId={recipe.id}
              summary={social.reactions}
              canReact={writer}
              t={t}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users size={16} aria-hidden />
              {t("recipes.servingsCount", {
                count: formatQuantity(recipe.servings, locale),
              })}
            </span>
            {recipe.prep_minutes !== null ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} aria-hidden />
                {t("recipes.prep", { count: recipe.prep_minutes })}
              </span>
            ) : null}
            {recipe.cook_minutes !== null ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} aria-hidden />
                {t("recipes.cook", { count: recipe.cook_minutes })}
              </span>
            ) : null}
          </div>
          {recipe.category || recipe.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {recipe.category ? (
                <Badge tone="brand">
                  {t(`recipes.category.${recipe.category}` as MessageKey)}
                </Badge>
              ) : null}
              {recipe.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          ) : null}
          {recipe.description ? (
            <p className="text-sm leading-relaxed text-muted">{recipe.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {writer ? (
              <>
                <Link
                  href={`/recipes/${recipe.id}/edit`}
                  className={buttonClass("secondary", "flex-1")}
                >
                  <Pencil size={16} aria-hidden />
                  {t("common.edit")}
                </Link>
                <ConfirmForm
                  action={deleteRecipe}
                  message={t("recipes.deleteConfirm")}
                  className="flex-1"
                >
                  <input type="hidden" name="id" value={recipe.id} />
                  <input type="hidden" name="householdId" value={household.id} />
                  <button type="submit" className={buttonClass("danger", "w-full")}>
                    <Trash2 size={16} aria-hidden />
                    {t("common.delete")}
                  </button>
                </ConfirmForm>
                {publishedAt ? (
                  <form action={unpublishRecipeFromCommunity} className="w-full sm:w-auto">
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button type="submit" className={buttonClass("ghost", "w-full text-xs")}>
                      {t("community.unshareCta")}
                    </button>
                  </form>
                ) : (
                  <form action={publishRecipeToCommunity} className="w-full sm:w-auto">
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button type="submit" className={buttonClass("primary", "w-full text-xs")}>
                      <Share2 size={14} aria-hidden />
                      {t("community.shareCta")}
                    </button>
                  </form>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <RecipeCostPanel
        householdId={household.id}
        baseServings={recipe.servings}
        ingredients={toCostIngredients(recipe.ingredients)}
        pricing={pricing}
        pantry={pantry}
        currency={household.currency}
        canWrite={writer}
      />

      <Card>
        <CardTitle>{t("recipes.instructions")}</CardTitle>
        {steps.length === 0 ? (
          <p className="text-sm text-muted">{t("recipes.noInstructions")}</p>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed">
                <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
                  {index + 1}
                </span>
                <span className="min-w-0 whitespace-pre-wrap">{step}</span>
              </li>
            ))}
          </ol>
        )}
        {recipe.source_url ? (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-brand"
          >
            <ExternalLink size={16} aria-hidden />
            {t("recipes.source")}
          </a>
        ) : null}
      </Card>

      {social ? (
        <Card>
          <CommentThread
            recipeId={recipe.id}
            comments={social.comments}
            currentUserId={ctx.user.id}
            canWrite={writer}
          />
        </Card>
      ) : null}
    </article>
  );
}
