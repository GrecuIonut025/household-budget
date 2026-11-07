"use client";

import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { useTheme, type ThemePreference } from "./theme-provider";
import { buttonClass } from "./ui";

const OPTIONS: {
  value: ThemePreference;
  icon: typeof Sun;
  labelKey: "theme.system" | "theme.light" | "theme.dark";
}[] = [
  { value: "system", icon: Monitor, labelKey: "theme.system" },
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
];

export function ThemeToggle({
  compact = false,
  tone = "default",
  variant = "button",
}: {
  compact?: boolean;
  /** Use on the dark navy sidebar so the control stays readable. */
  tone?: "default" | "sidebar";
  /** Pill shows sun/moon like the Bugetify reference. */
  variant?: "button" | "pill";
}) {
  const { preference, setPreference, cycle, resolved } = useTheme();
  const { t } = useI18n();

  if (variant === "pill") {
    const isDark = resolved === "dark";
    return (
      <div
        role="group"
        aria-label={t("theme.label")}
        className="inline-flex w-full items-center rounded-full border border-sidebar-border bg-sidebar-hover/80 p-1"
      >
        <button
          type="button"
          onClick={() => setPreference("light")}
          aria-pressed={!isDark}
          className={clsx(
            "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition",
            !isDark ? "bg-surface text-fg shadow-sm" : "text-sidebar-muted hover:text-sidebar-fg",
          )}
          title={t("theme.light")}
        >
          <Sun size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPreference("dark")}
          aria-pressed={isDark}
          className={clsx(
            "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition",
            isDark ? "brand-gradient text-brand-fg shadow-sm" : "text-sidebar-muted hover:text-sidebar-fg",
          )}
          title={t("theme.dark")}
        >
          <Moon size={15} aria-hidden />
        </button>
      </div>
    );
  }

  if (compact) {
    const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0]!;
    const Icon = current.icon;
    return (
      <button
        type="button"
        onClick={cycle}
        className={
          tone === "sidebar"
            ? "inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-fg"
            : buttonClass("ghost", "size-10 shrink-0 px-0")
        }
        aria-label={t("theme.toggle", { mode: t(current.labelKey) })}
        title={t(current.labelKey)}
      >
        <Icon size={18} aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("theme.label")}
      className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, icon: Icon, labelKey }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            aria-pressed={active}
            className={clsx(
              "inline-flex min-h-9 items-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] px-2.5 text-xs font-medium transition",
              active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon size={14} aria-hidden />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
