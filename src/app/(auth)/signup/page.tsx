import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { safeNextPath } from "@/lib/auth/safe-next";
import { getTranslator } from "@/lib/i18n/server";
import { signUp } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("auth.signUp") };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="signup" action={signUp} next={safeNextPath(params.next)} />;
}
