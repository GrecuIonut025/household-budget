import { en, type MessageKey } from "./en";
import { ro } from "./ro";

export const LOCALES = ["ro", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ro";
export const LOCALE_COOKIE = "hb_locale";

export type { MessageKey };
export type Messages = Record<MessageKey, string>;

const catalogs: Record<Locale, Messages> = { en, ro };

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "ro" || value === "en";
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

const PLURAL = /\{(\w+),\s*plural,\s*((?:\w+\s*\{[^}]*\}\s*)+)\}/g;
const PLURAL_CASE = /(\w+)\s*\{([^}]*)\}/g;

function formatMessage(template: string, locale: Locale, params: TranslateParams = {}): string {
  const withPlurals = template.replace(PLURAL, (_, name: string, cases: string) => {
    const value = Number(params[name] ?? 0);
    const category = new Intl.PluralRules(locale).select(value);
    const table = new Map<string, string>();
    for (const m of cases.matchAll(PLURAL_CASE)) table.set(m[1], m[2]);
    return (table.get(category) ?? table.get("other") ?? "").replace(/#/g, String(value));
  });
  return withPlurals.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function createTranslator(locale: Locale, messages: Messages = getMessages(locale)): Translate {
  return (key, params) => formatMessage(messages[key] ?? en[key], locale, params);
}
