import { parseISODate, todayInTimezone } from "./dates";
import { localeTag } from "./money";

export function formatDate(iso: string, locale: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat(localeTag(locale), { ...opts, timeZone: "UTC" }).format(parseISODate(iso));
}

export function formatDateLong(iso: string, locale: string): string {
  return formatDate(iso, locale, { weekday: "long", day: "numeric", month: "long" });
}

export function formatMonthLabel(month: string, locale: string): string {
  return formatDate(`${month}-01`, locale, { month: "long", year: "numeric" });
}

export function todayFor(timezone: string): string {
  return todayInTimezone(timezone);
}
