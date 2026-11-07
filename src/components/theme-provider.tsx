"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  parseThemePreference,
  themeHtmlClass,
  THEME_COOKIE,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

export type { ThemePreference, ResolvedTheme };

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (value: ThemePreference) => void;
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function writeCookie(value: ThemePreference) {
  try {
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return systemDark() ? "dark" : "light";
  return preference;
}

/** Apply forced light/dark classes; system clears both and lets CSS media decide. */
export function applyThemePreference(preference: ThemePreference) {
  const root = document.documentElement;
  const forced = themeHtmlClass(preference);
  root.classList.toggle("light", forced === "light");
  root.classList.toggle("dark", forced === "dark");
  root.style.colorScheme = resolveTheme(preference);
}

type StoreListener = () => void;
const listeners = new Set<StoreListener>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: StoreListener) {
  listeners.add(listener);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    if (readStored() === "system") {
      applyThemePreference("system");
      emit();
    }
  };
  mq.addEventListener("change", onScheme);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onScheme);
    window.removeEventListener("storage", onStorage);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  return readStored();
}

function getPreferenceServerSnapshot(): ThemePreference {
  return "system";
}

function getResolvedSnapshot(): ResolvedTheme {
  return resolveTheme(readStored());
}

function getResolvedServerSnapshot(): ResolvedTheme {
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );
  const resolved = useSyncExternalStore(
    subscribe,
    getResolvedSnapshot,
    getResolvedServerSnapshot,
  );

  // Sync localStorage → cookie + html class after hydration (migrates pre-cookie prefs).
  useLayoutEffect(() => {
    const stored = readStored();
    writeCookie(stored);
    applyThemePreference(stored);
  }, []);

  const setPreference = useCallback((value: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    writeCookie(value);
    applyThemePreference(value);
    emit();
  }, []);

  const cycle = useCallback(() => {
    const order: ThemePreference[] = ["system", "light", "dark"];
    const i = order.indexOf(preference);
    setPreference(order[(i + 1) % order.length]!);
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
