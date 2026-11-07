/** Shared theme preference helpers (safe for server and client). */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "hb-theme";
export const THEME_COOKIE = "hb-theme";

export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  // Dark-first product chrome (Bugetify reference); users can still pick light/system.
  return "dark";
}

/** Class applied on `<html>` for forced preferences. System → no class (CSS media). */
export function themeHtmlClass(preference: ThemePreference): "light" | "dark" | "" {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return "";
}
