import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  Plus,
  Search,
  Share2,
  Sparkles,
  Target,
} from "lucide-react";
import { publishRecipeToCommunity } from "@/app/actions/community";
import { FeedInfinite } from "@/components/community/feed-infinite";
import { TipCard } from "@/components/community/tip-card";
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
import { getCommunityFeedPage } from "@/lib/data/community";
import { requireAppContext } from "@/lib/data/context";
import { getRecipesWithIngredients } from "@/lib/data/recipes";
import { canWrite, isAdmin } from "@/lib/data/types";
import { todayFor } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { formatMoney, toMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

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
  const money = (minor: number) => formatMoney(minor, household.currency, locale);

  const tab =
    params.tab === "tips" || params.tab === "share" ? params.tab : "feed";
  const q = (params.q ?? "").trim().toLowerCase();

  const [feed, budget, categories, householdRecipes] = await Promise.all([
    tab === "feed"
      ? getCommunityFeedPage({ currentUserId: ctx.user.id }).catch(() => ({
          items: [] as Awaited<ReturnType<typeof getCommunityFeedPage>>["items"],
          nextCursor: null,
        }))
      : Promise.resolve({ items: [], nextCursor: null }),
    getCurrentBudget(household.id, today),
    getCategories(household.id),
    tab === "share" && writer
      ? getRecipesWithIngredients(household.id)
      : Promise.resolve([]),
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

  let unpublished: { id: string; title: string }[] = [];
  if (tab === "share" && writer && householdRecipes.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("recipes")
      .select("id, title, community_published_at")
      .eq("household_id", household.id)
      .is("community_published_at", null)
      .order("title");
    unpublished = (data ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
    }));
  }

  const filteredTips = COMMUNITY_TIPS.filter((tip) => {
    if (tab !== "tips") return false;
    if (!q) return true;
    return (
      t(tip.titleKey).toLowerCase().includes(q) ||
      t(tip.bodyKey).toLowerCase().includes(q)
    );
  });

  const href = (next: Partial<Search>) => {
    const merged = { tab: params.tab, q: params.q, ...next };
    const qs = new URLSearchParams();
    if (merged.tab && merged.tab !== "feed") qs.set("tab", merged.tab);
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
              {t("community.subtitleGlobal")}
            </p>
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
        {tab === "tips" ? (
          <form action="/community" className="relative">
            <input type="hidden" name="tab" value="tips" />
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
        ) : null}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["feed", "community.tab.feed"],
              ["tips", "community.tab.tips"],
              ...(writer ? ([["share", "community.tab.share"]] as const) : []),
            ] as const
          ).map(([id, label]) => (
            <Link
              key={id}
              href={href({ tab: id === "feed" ? undefined : id, q: undefined })}
              className={chip(tab === id)}
            >
              {id === "share" ? <Share2 size={14} aria-hidden /> : null}
              {t(label)}
            </Link>
          ))}
        </div>
      </div>

      {tab === "feed" ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-fg">{t("community.feedTitle")}</h2>
          <FeedInfinite
            initial={feed}
            householdId={household.id}
            canFavorite={writer}
            canReact={writer}
            emptyTitle={t("community.feedEmptyTitle")}
            emptyBody={t("community.feedEmptyBody")}
          />
        </section>
      ) : null}

      {tab === "tips" ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-fg">{t("community.tipsTitle")}</h2>
          {filteredTips.length === 0 ? (
            <div className="dashboard-card p-5">
              <EmptyState
                icon={<Sparkles size={22} aria-hidden />}
                title={t("community.tipsEmptyTitle")}
                body={t("community.tipsEmptyBody")}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTips.map((tip) => (
                <TipCard key={tip.id} tip={tip} t={t} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "share" && writer ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-fg">{t("community.shareTitle")}</h2>
          <p className="text-sm text-muted">{t("community.shareBody")}</p>
          {unpublished.length === 0 ? (
            <div className="dashboard-card p-5">
              <EmptyState
                icon={<Share2 size={22} aria-hidden />}
                title={t("community.shareEmptyTitle")}
                body={t("community.shareEmptyBody")}
                action={
                  <Link href="/recipes/new" className={buttonClass("primary")}>
                    <Plus size={16} aria-hidden />
                    {t("community.recipesEmptyCta")}
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {unpublished.map((r) => (
                <li
                  key={r.id}
                  className="dashboard-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="min-w-0 truncate text-sm font-semibold text-fg">{r.title}</p>
                  <form action={publishRecipeToCommunity}>
                    <input type="hidden" name="householdId" value={household.id} />
                    <input type="hidden" name="recipeId" value={r.id} />
                    <button type="submit" className={buttonClass("primary", "text-xs")}>
                      <Share2 size={14} aria-hidden />
                      {t("community.shareCta")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
