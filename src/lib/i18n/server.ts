import "server-only";
import { cookies, headers } from "next/headers";
import { createTranslator, DEFAULT_LOCALE, getMessages, isLocale, LOCALE_COOKIE, type Locale, type Messages, type Translate } from "./index";

export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  const accept = (await headers()).get("accept-language") ?? "";
  if (/^\s*en/i.test(accept)) return "en";
  return DEFAULT_LOCALE;
}

export async function getTranslator(): Promise<{ t: Translate; locale: Locale; messages: Messages }> {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return { t: createTranslator(locale, messages), locale, messages };
}
