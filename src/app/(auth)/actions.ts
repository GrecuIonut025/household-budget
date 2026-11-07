"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/form-state";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createTranslator, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

async function translator() {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return createTranslator(isLocale(stored) ? stored : DEFAULT_LOCALE);
}

const credentials = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await translator();
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: t("auth.invalidCredentials") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: t("auth.invalidCredentials") };
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await translator();
  const parsed = credentials
    .extend({ displayName: z.string().trim().max(80) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName") ?? "",
    });
  if (!parsed.success) return { error: t("auth.passwordRule") };

  const origin = (await headers()).get("origin") ?? "";
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message };
  if (data.session) redirect(next);
  return { ok: true, message: t("auth.checkEmail") };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
