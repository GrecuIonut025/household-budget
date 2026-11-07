"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ActionState } from "./form-state";
import { SubmitButton } from "./submit-button";
import { Alert, Field, inputClass } from "./ui";
import { useI18n } from "@/lib/i18n/provider";

export function AuthForm({
  mode,
  action,
  next,
  initialError,
}: {
  mode: "signin" | "signup";
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  next: string;
  initialError?: string;
}) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(action, initialError ? { error: initialError } : {});
  const nextQuery = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-fg">
          {mode === "signin" ? t("auth.signInTitle") : t("auth.signUpTitle")}
        </h1>
        <p className="text-sm font-medium text-muted">{t("app.tagline")}</p>
      </div>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" ? (
          <Field label={t("auth.displayName")} htmlFor="displayName">
            <input id="displayName" name="displayName" autoComplete="name" className={inputClass} />
          </Field>
        ) : null}
        <Field label={t("auth.email")} htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className={inputClass} />
        </Field>
        <Field label={t("auth.password")} htmlFor="password" hint={mode === "signup" ? t("auth.passwordRule") : undefined}>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className={inputClass}
          />
        </Field>
        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.message ? <Alert tone="ok">{state.message}</Alert> : null}
        <SubmitButton className="w-full">{mode === "signin" ? t("auth.signIn") : t("auth.signUp")}</SubmitButton>
      </form>
      <p className="text-center text-sm text-muted">
        {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <Link href={`${mode === "signin" ? "/signup" : "/login"}${nextQuery}`} className="font-medium text-brand-strong underline-offset-4 hover:underline">
          {mode === "signin" ? t("auth.signUp") : t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
