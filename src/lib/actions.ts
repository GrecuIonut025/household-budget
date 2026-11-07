import "server-only";
import { cookies } from "next/headers";
import { createTranslator, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Translate } from "@/lib/i18n";
import { parseMoneyInput, fromMinor } from "@/lib/money";

export async function getActionTranslator(): Promise<Translate> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return createTranslator(isLocale(stored) ? stored : DEFAULT_LOCALE);
}

interface DbError {
  code?: string;
  message: string;
}

/** Maps a Postgres / PostgREST error to a user-facing message without leaking internals. */
export function describeDbError(error: DbError, t: Translate, overrides: Record<string, string> = {}): string {
  if (error.code && overrides[error.code]) return overrides[error.code];
  if (error.code === "42501") return t("common.noPermission");
  return t("common.errorGeneric");
}

/** Parses an optional money field; returns undefined when empty and null when invalid. */
export function readMoney(value: FormDataEntryValue | null): number | null | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  const minor = parseMoneyInput(raw);
  return minor === null ? null : fromMinor(minor);
}
