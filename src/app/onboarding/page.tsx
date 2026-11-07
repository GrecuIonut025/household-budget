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
    <main className="mx-auto w-full max-w-lg space-y-5 px-5 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("onboarding.title")}</h1>
        <p className="text-sm text-muted">{t("onboarding.subtitle")}</p>
      </header>
      <CreateHouseholdForm />
      <JoinHouseholdForm />
      {memberships.length > 0 ? (
        <Link href="/" className="block text-center text-sm font-medium text-brand-strong">
          {t("common.back")}
        </Link>
      ) : null}
    </main>
  );
}
