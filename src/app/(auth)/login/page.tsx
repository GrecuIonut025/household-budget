import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getTranslator } from "@/lib/i18n/server";
import { signIn } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("auth.signIn") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const { t } = await getTranslator();
  return (
    <AuthForm
      mode="signin"
      action={signIn}
      next={safeNextPath(params.next)}
      initialError={params.error === "confirm" ? t("auth.confirmFailed") : undefined}
    />
  );
}
