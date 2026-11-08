import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Lightbulb, Search, Sparkles } from "lucide-react";
import { ComposeTrigger, type ComposeRecipe } from "@/components/community/compose-sheet";
import { FeedInfinite } from "@/components/community/feed-infinite";
import { TipCard } from "@/components/community/tip-card";
import { EmptyState, inputClass } from "@/components/ui";
import { COMMUNITY_TIPS } from "@/lib/community/tips";
import { getCommunityFeedPage } from "@/lib/data/community";
import { requireAppContext } from "@/lib/data/context";
import { getImageUrls } from "@/lib/data/recipes";
import { canWrite } from "@/lib/data/types";
import { getTranslator } from "@/lib/i18n/server";
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
  const { t } = await getTranslator();
  const { household, role } = ctx.active;
  const writer = canWrite(role);

  const tab = params.tab === "tips" ? "tips" : "feed";
  const q = (params.q ?? "").trim().toLowerCase();

  const [feed, composeRecipes] = await Promise.all([
    tab === "feed"
      ? getCommunityFeedPage({ currentUserId: ctx.user.id }).catch(() => ({
          items: [] as Awaited<ReturnType<typeof getCommunityFeedPage>>["items"],
          nextCursor: null,
        }))
      : Promise.resolve({ items: [], nextCursor: null }),
    writer ? loadComposeRecipes(household.id) : Promise.resolve([] as ComposeRecipe[]),
  ]);

  const filteredTips = COMMUNITY_TIPS.filter((tip) => {
    if (tab !== "tips") return false;
    if (!q) return true;
    return (
      t(tip.titleKey).toLowerCase().includes(q) ||
      t(tip.bodyKey).toLowerCase().includes(q)
    );
  });

  return (
    <div className="-mx-4 flex justify-center sm:-mx-6 md:mx-0 md:px-0">
      <div className="w-full max-w-[470px] border-border md:rounded-2xl md:border md:bg-surface md:shadow-card">
        <header className="sticky top-14 z-10 flex items-center gap-2 border-b border-border-soft bg-bg/95 px-3 py-2.5 backdrop-blur md:top-0 md:rounded-t-2xl md:bg-surface/95">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-bold tracking-tight text-fg">
              {t("community.title")}
            </h1>
          </div>
          <nav className="flex items-center gap-1" aria-label={t("community.title")}>
            <Link
              href="/community?tab=tips"
              className={clsx(
                "inline-flex size-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg",
                tab === "tips" && "bg-surface-2 text-fg",
              )}
              aria-label={t("community.tab.tips")}
              title={t("community.tab.tips")}
            >
              <Lightbulb size={18} aria-hidden />
            </Link>
            {writer ? <ComposeTrigger householdId={household.id} recipes={composeRecipes} /> : null}
          </nav>
        </header>

        {tab === "feed" ? (
          <FeedInfinite
            initial={feed}
            householdId={household.id}
            canFavorite={writer}
            canReact={writer}
            currentUserId={ctx.user.id}
            emptyTitle={t("community.feedEmptyTitle")}
            emptyBody={t("community.feedEmptyBody")}
            emptyAction={
              writer ? (
                <ComposeTrigger
                  householdId={household.id}
                  recipes={composeRecipes}
                  variant="cta"
                />
              ) : undefined
            }
          />
        ) : null}

        {tab === "tips" ? (
          <section className="space-y-4 p-4">
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
            <h2 className="text-base font-semibold text-fg">{t("community.tipsTitle")}</h2>
            {filteredTips.length === 0 ? (
              <EmptyState
                icon={<Sparkles size={22} aria-hidden />}
                title={t("community.tipsEmptyTitle")}
                body={t("community.tipsEmptyBody")}
              />
            ) : (
              <div className="grid gap-3">
                {filteredTips.map((tip) => (
                  <TipCard key={tip.id} tip={tip} t={t} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

async function loadComposeRecipes(householdId: string): Promise<ComposeRecipe[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("id, title, description, image_path")
    .eq("household_id", householdId)
    .is("community_published_at", null)
    .order("title");
  const rows = data ?? [];
  const urls = await getImageUrls(rows.map((r) => r.image_path as string | null));
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    imageUrl: r.image_path ? (urls[r.image_path as string] ?? null) : null,
  }));
}
