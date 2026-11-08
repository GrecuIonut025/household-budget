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

/** Compact relative time for notification / comment timestamps. */
export function formatRelativeTime(iso: string, locale: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");
  const diffWeek = Math.round(diffDay / 7);
  if (Math.abs(diffWeek) < 5) return rtf.format(diffWeek, "week");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  return rtf.format(Math.round(diffDay / 365), "year");
}
