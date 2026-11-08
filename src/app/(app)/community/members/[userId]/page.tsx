import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChefHat } from "lucide-react";
import { AuthorChip } from "@/components/community/author-chip";
import { GradeBadge } from "@/components/community/grade-badge";
import { EmptyState, buttonClass } from "@/components/ui";
import {
  getMemberCommunityProfile,
  getMemberPublishedRecipes,
} from "@/lib/data/community";
import { requireAppContext } from "@/lib/data/context";
import { getTranslator } from "@/lib/i18n/server";
import { z } from "zod";

type Params = { userId: string };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("community.member.title") };
}

export default async function CommunityMemberPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { userId } = await params;
  const parsed = z.uuid().safeParse(userId);
  if (!parsed.success) notFound();

  const ctx = await requireAppContext();
  const { t } = await getTranslator();

  const profile = await getMemberCommunityProfile(parsed.data);
  if (!profile) notFound();

  const { items } = await getMemberPublishedRecipes(parsed.data, ctx.user.id);

  return (
    <div className="space-y-6">
      <Link
        href="/community"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        {t("community.member.back")}
      </Link>

      <section className="dashboard-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <AuthorChip author={profile} t={t} />
          <GradeBadge grade={profile.grade} t={t} />
        </div>
        <p className="text-sm text-muted">
          {t("community.member.reactionsReceived", {
            count: profile.reactionsReceived,
          })}
          {" · "}
          {t(`community.grade.${profile.grade}`)}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-fg">{t("community.member.recipes")}</h2>
        {items.length === 0 ? (
          <div className="dashboard-card p-5">
            <EmptyState
              icon={<ChefHat size={22} aria-hidden />}
              title={t("community.member.emptyRecipes")}
            />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  href={`/community/posts/${recipe.id}`}
                  className="dashboard-card flex gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {recipe.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={recipe.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-brand/40">
                        <ChefHat size={22} aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold text-fg">
                      {recipe.title}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted">
                      {t("community.showComments", { count: recipe.commentCount })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/community" className={buttonClass("secondary")}>
        {t("community.member.back")}
      </Link>
    </div>
  );
}
