import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateHouseholdForm, JoinHouseholdForm } from "@/components/onboarding-forms";
import { SetupRequired } from "@/components/setup-required";
import { getMemberships, getUser } from "@/lib/data/context";
import { getTranslator } from "@/lib/i18n/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("onboarding.title") };
}

export default async function OnboardingPage() {
  if (!getSupabaseEnv()) return <SetupRequired />;
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getTranslator();
  const memberships = await getMemberships();

  return (
    <main className="relative mx-auto w-full max-w-lg space-y-5 px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.16),_transparent_55%)]"
      />
      <header className="flex items-center gap-3">
        <div className="relative size-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-400 p-0.5 shadow-lg shadow-indigo-600/30 ring-1 ring-white/20">
          <div className="flex size-full items-center justify-center overflow-hidden rounded-[14px] bg-sidebar p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" width={36} height={36} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-fg">{t("app.name")}</p>
          <h1 className="text-2xl font-bold tracking-tight text-fg">{t("onboarding.title")}</h1>
          <p className="mt-1 text-sm font-medium text-muted">{t("onboarding.subtitle")}</p>
        </div>
      </header>
      <div className="dashboard-card space-y-5 p-5 sm:p-6">
        <CreateHouseholdForm />
        <JoinHouseholdForm />
      </div>
      {memberships.length > 0 ? (
        <Link href="/" className="block text-center text-sm font-semibold text-brand-strong">
          {t("common.back")}
        </Link>
      ) : null}
    </main>
  );
}
