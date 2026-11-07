import { addDays, diffDays, parseISODate, toISODate } from "@/lib/dates";
import type { MealType } from "./types";

export const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/** Monday-based week containing `iso` (ISO date). */
export function weekContaining(iso: string): { start: string; end: string; days: string[] } {
  const date = parseISODate(iso);
  const weekday = date.getUTCDay(); // 0 Sun … 6 Sat
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addDays(iso, mondayOffset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { start, end: days[6], days };
}

export function shiftWeek(weekStart: string, deltaWeeks: number): string {
  return addDays(weekStart, deltaWeeks * 7);
}

export function isValidWeekStart(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (toISODate(parseISODate(value)) !== value) return false;
  return parseISODate(value).getUTCDay() === 1;
}

/** Clamp an arbitrary date to the Monday of its week. */
export function mondayOf(iso: string): string {
  return weekContaining(iso).start;
}

export function daysBetweenInclusive(start: string, end: string): string[] {
  const n = diffDays(start, end);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}
