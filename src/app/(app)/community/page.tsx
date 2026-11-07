import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  Heart,
  Plus,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { TipCard } from "@/components/community/tip-card";
import { FavoriteButton } from "@/components/recipes/favorite-button";
import { EmptyState, ProgressBar, buttonClass, inputClass } from "@/components/ui";
import { COMMUNITY_TIPS } from "@/lib/community/tips";
import { computeBudgetSummary } from "@/lib/budget-engine";
import {
  getActiveReservations,
  getCategories,
  getCurrentBudget,
  getTransactionsBetween,
  toEngineReservations,
  toEngineTransactions,
} from "@/lib/data/budget";
import { requireAppContext } from "@/lib/data/context";
import { getImageUrls, getRecipesWithIngredients } from "@/lib/data/recipes";
import { canWrite, isAdmin } from "@/lib/data/types";
import { todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("nav.community") };
}

type Search = { tab?: string; q?: string };

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const ctx = await requireAppContext();
  const { t, locale } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);
  const admin = isAdmin(role);
  const today = todayFor(household.timezone);
  const money = (minor: number) =>
    formatMoney(minor, household.currency, locale);

  const tab =
    params.tab === "recipes" || params.tab === "tips" || params.tab === "favorites"
      ? params.tab
      : "all";
  const q = (params.q ?? "").trim().toLowerCase();

  const [recipes, budget, categories] = await Promise.all([
    getRecipesWithIngredients(household.id),
    getCurrentBudget(household.id, today),
    getCategories(household.id),
  ]);

  const periodTransactions = budget
    ? await getTransactionsBetween(household.id, budget.start_date, budget.end_date)
    : [];
  const reservations = budget ? await getActiveReservations(budget.id) : [];
  const summary = budget
    ? computeBudgetSummary({
        budget: {
          startDate: budget.start_date,
          endDate: budget.end_date,
          spendingLimit:
            budget.spending_limit === null ? null : toMinor(budget.spending_limit),
          groceryLimit:
            budget.grocery_limit === null ? null : toMinor(budget.grocery_limit),
        },
        transactions: toEngineTransactions(periodTransactions, categories),
        reservations: toEngineReservations(reservations),
        today,
      })
    : null;

  const favorites = recipes.filter((r) => r.is_favorite);
  const filteredRecipes = recipes.filter((r) => {
    if (tab === "favorites" && !r.is_favorite) return false;
    if (tab === "tips") return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      (r.description?.toLowerCase().includes(q) ?? false)
    );
  });

  const filteredTips = COMMUNITY_TIPS.filter((tip) => {
    if (tab === "recipes" || tab === "favorites") return false;
    if (!q) return true;
    return (
      t(tip.titleKey).toLowerCase().includes(q) ||
      t(tip.bodyKey).toLowerCase().includes(q)
    );
  });

  const imageUrls = await getImageUrls(
    filteredRecipes.map((r) => r.image_path).filter(Boolean) as string[],
  );

  const href = (next: Partial<Search>) => {
    const merged = { tab: params.tab, q: params.q, ...next };
    const qs = new URLSearchParams();
    if (merged.tab && merged.tab !== "all") qs.set("tab", merged.tab);
    if (merged.q) qs.set("q", merged.q);
    const s = qs.toString();
    return s ? `/community?${s}` : "/community";
  };

  const chip = (active: boolean) =>
    clsx(
      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
      active
        ? "border-brand bg-brand-soft text-brand-strong"
        : "border-border bg-surface text-muted hover:text-fg",
    );

  const showRecipes = tab === "all" || tab === "recipes" || tab === "favorites";
  const showTips = tab === "all" || tab === "tips";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#1f2642] bg-gradient-to-r from-[#111528] via-[#151a33] to-[#0e1122] p-6 lg:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.22),_transparent_55%)]"
        />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-[11px] font-semibold text-indigo-300">
              <Sparkles size={14} aria-hidden />
              {t("nav.badgeNew")}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">
              {t("community.title")}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm font-medium text-slate-300 lg:text-base">
              {t("community.subtitle")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {t("community.statsRecipes", { count: recipes.length })}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {t("community.statsFavorites", { count: favorites.length })}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {t("community.statsTips", { count: COMMUNITY_TIPS.length })}
              </span>
            </div>
          </div>
          <p className="whitespace-pre-line font-handwriting rotate-[-2deg] text-2xl tracking-wide text-slate-200 drop-shadow-md md:pr-2 md:text-right lg:text-3xl">
            {t("community.heroQuote")}
          </p>
        </div>
      </section>

      <section className="dashboard-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
              <Target size={20} aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-fg">{t("community.challengeTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("community.challengeBody")}</p>
            </div>
          </div>
          <Link
            href={
              summary?.groceryLimit === null || summary?.groceryLimit === undefined
                ? admin
                  ? "/settings#budget"
                  : "/meal-planner"
                : "/meal-planner"
            }
            className={buttonClass("primary", "shrink-0")}
          >
            {summary?.groceryLimit === null || summary?.groceryLimit === undefined
              ? admin
                ? t("community.challengeSetLimit")
                : t("community.challengeCta")
              : t("community.challengeCta")}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
        {summary?.groceryLimit !== null && summary?.groceryLimit !== undefined ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="text-muted">
                {t("community.challengeProgress", {
                  spent: money(summary.groceryExpenses),
                  limit: money(summary.groceryLimit),
                })}
              </p>
              <p className="tabular font-semibold text-fg">
                {Math.min(
                  100,
                  Math.round((summary.groceryExpenses / Math.max(summary.groceryLimit, 1)) * 100),
                )}
                %
              </p>
            </div>
            <ProgressBar
              value={summary.groceryExpenses + summary.reservedGrocery}
              max={summary.groceryLimit}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("community.challengeNoLimit")}</p>
        )}
      </section>

      <div className="space-y-3">
        <form action="/community" className="relative">
          {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={t("community.searchPlaceholder")}
            className={clsx(inputClass, "pl-11")}
          />
        </form>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["all", "community.tab.all"],
              ["recipes", "community.tab.recipes"],
              ["tips", "community.tab.tips"],
              ["favorites", "community.tab.favorites"],
            ] as const
          ).map(([id, label]) => (
            <Link key={id} href={href({ tab: id === "all" ? undefined : id })} className={chip(tab === id)}>
              {id === "favorites" ? <Heart size={14} aria-hidden /> : null}
              {t(label)}
            </Link>
          ))}
        </div>
      </div>

      {showRecipes ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-fg">{t("community.recipesTitle")}</h2>
            <Link
              href="/recipes"
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300"
            >
              {t("community.openRecipes")} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>

          {filteredRecipes.length === 0 ? (
            <div className="dashboard-card p-5">
              <EmptyState
                icon={<Sparkles size={22} aria-hidden />}
                title={
                  tab === "favorites"
                    ? t("community.favoritesEmptyTitle")
                    : t("community.recipesEmptyTitle")
                }
                body={
                  tab === "favorites"
                    ? t("community.favoritesEmptyBody")
                    : t("community.recipesEmptyBody")
                }
                action={
                  writer && tab !== "favorites" ? (
                    <Link href="/recipes/new" className={buttonClass("primary")}>
                      <Plus size={16} aria-hidden />
                      {t("community.recipesEmptyCta")}
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredRecipes.map((recipe) => {
                const minutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
                const imageUrl = recipe.image_path
                  ? (imageUrls[recipe.image_path] ?? null)
                  : null;
                return (
                  <li key={recipe.id}>
                    <article className="dashboard-card flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt=""
                            className="size-full object-cover transition duration-500 hover:scale-105"
                          />
                        ) : (
                          <div className="grid size-full place-items-center bg-gradient-to-br from-brand-soft to-surface-2 text-brand/50">
                            <Sparkles size={36} aria-hidden />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        {writer ? (
                          <div className="absolute top-2 right-2">
                            <FavoriteButton
                              recipeId={recipe.id}
                              householdId={household.id}
                              isFavorite={recipe.is_favorite}
                              label={
                                recipe.is_favorite
                                  ? t("recipes.unfavorite")
                                  : t("recipes.favorite")
                              }
                              className="size-9 bg-black/35 text-white hover:text-pink-300"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <h3 className="line-clamp-2 text-sm font-bold tracking-tight text-fg">
                          {recipe.title}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-[11px] text-muted">
                          {minutes > 0 ? <span>{t("recipes.minutes", { count: minutes })}</span> : null}
                          <span>{t("recipes.servingsCount", { count: recipe.servings })}</span>
                          {recipe.category ? (
                            <span>{t(`recipes.category.${recipe.category}`)}</span>
                          ) : null}
                        </div>
                        {recipe.description ? (
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                            {recipe.description}
                          </p>
                        ) : null}
                        <div className="mt-auto flex items-center gap-2 border-t border-border-soft pt-3">
                          <Link
                            href={`/recipes/${recipe.id}`}
                            className="btn-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                          >
                            {t("community.viewRecipe")}
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {showTips ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-fg">{t("community.tipsTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTips.map((tip) => (
              <TipCard key={tip.id} tip={tip} t={t} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
