import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ChefHat, Heart, Plus, Search } from "lucide-react";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { requireAppContext } from "@/lib/data/context";
import { createSupabasePricingLookup, getImageUrls, getRecipesWithIngredients } from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import { todayFor } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { computeRecipeCost } from "@/lib/recipes/cost";
import { lookupPricing } from "@/lib/recipes/pricing";
import { RECIPE_CATEGORIES, isRecipeCategory } from "@/lib/recipes/schema";
import { toCostIngredients } from "@/lib/recipes/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.recipes") };
}

type Search = { q?: string; category?: string; fav?: string };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);

  const q = (params.q ?? "").trim().toLowerCase();
  const category = isRecipeCategory(params.category) ? params.category : "";
  const favoritesOnly = params.fav === "1";

  const all = await getRecipesWithIngredients(household.id);
  const filtered = all.filter(
    (r) =>
      (!q || r.title.toLowerCase().includes(q) || r.tags.some((tag) => tag.toLowerCase().includes(q))) &&
      (!category || r.category === category) &&
      (!favoritesOnly || r.is_favorite),
  );

  const productIds = filtered.flatMap((r) => r.ingredients.flatMap((i) => (i.product_id ? [i.product_id] : [])));
  const lookup = await createSupabasePricingLookup({ householdId: household.id, currency: household.currency, today: todayFor(household.timezone) });
  const [pricing, imageUrls] = await Promise.all([lookupPricing(lookup, productIds), getImageUrls(filtered.map((r) => r.image_path))]);

  const href = (next: Partial<Search>) => {
    const merged = { q: params.q, category: params.category, fav: params.fav, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]);
    return qs.size ? `/recipes?${qs.toString()}` : "/recipes";
  };
  const chip = (active: boolean) =>
    clsx(
      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
      active ? "border-brand bg-brand-soft text-brand-strong" : "border-border bg-surface text-muted hover:text-fg",
    );

  return (
    <>
      <PageHeader
        title={t("nav.recipes")}
        subtitle={all.length ? t("recipes.count", { count: all.length }) : undefined}
        action={
          writer ? (
            <Link href="/recipes/new" className={buttonClass("primary")}>
              <Plus size={18} aria-hidden />
              {t("recipes.new")}
            </Link>
          ) : undefined
        }
      />

      {all.length > 0 ? (
        <div className="mb-5 space-y-3">
          <form action="/recipes" className="relative">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            {favoritesOnly ? <input type="hidden" name="fav" value="1" /> : null}
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" name="q" defaultValue={params.q ?? ""} placeholder={t("recipes.search")} aria-label={t("recipes.search")} className={`${inputClass} pl-10`} />
          </form>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            <Link href={href({ fav: favoritesOnly ? undefined : "1" })} className={chip(favoritesOnly)} aria-pressed={favoritesOnly}>
              <Heart size={16} aria-hidden fill={favoritesOnly ? "currentColor" : "none"} />
              {t("recipes.favorites")}
            </Link>
            <Link href={href({ category: undefined })} className={chip(!category)}>
              {t("recipes.category.all")}
            </Link>
            {RECIPE_CATEGORIES.map((c) => (
              <Link key={c} href={href({ category: c })} className={chip(category === c)}>
                {t(`recipes.category.${c}` as MessageKey)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ChefHat size={32} aria-hidden />}
            title={all.length === 0 ? t("recipes.empty.title") : t("recipes.empty.filtered")}
            body={all.length === 0 ? t("recipes.empty.body") : undefined}
            action={
              all.length === 0 && writer ? (
                <Link href="/recipes/new" className={buttonClass("primary")}>
                  <Plus size={18} aria-hidden />
                  {t("recipes.new")}
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => {
            const cost = computeRecipeCost({
              baseServings: recipe.servings,
              targetServings: recipe.servings,
              ingredients: toCostIngredients(recipe.ingredients),
              pricing,
            });
            return (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                imageUrl={recipe.image_path ? (imageUrls[recipe.image_path] ?? null) : null}
                cost={{
                  perServing: cost.perServingMinor === null ? null : formatMoney(cost.perServingMinor, household.currency, locale),
                  partial: cost.unknownCount > 0,
                }}
                t={t}
                locale={locale}
                householdId={household.id}
                canWrite={writer}
              />
            );
          })}
        </ul>
      )}
      {!writer ? <p className="mt-4 text-center text-xs text-muted">{t("common.viewOnly")}</p> : null}
    </>
  );
}
