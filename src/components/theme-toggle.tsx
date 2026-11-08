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
  const { preference, resolved, setPreference, cycle } = useTheme();
  const { t } = useI18n();

  if (variant === "pill" || (compact && tone === "sidebar")) {
    const lightActive = resolved === "light";
    const darkActive = resolved === "dark";
    return (
      <div
        role="group"
        aria-label={t("theme.label")}
        className={clsx(
          "flex items-center justify-between rounded-full border border-sidebar-border bg-card p-1.5",
          variant === "pill" ? "w-full" : "mx-auto w-24",
        )}
        title={
          preference === "system"
            ? t("theme.toggle", { mode: t("theme.system") })
            : undefined
        }
      >
        <button
          type="button"
          onClick={() => setPreference(preference === "light" ? "system" : "light")}
          className={clsx(
            "flex touch-manipulation items-center justify-center rounded-full transition-colors",
            variant === "pill" ? "h-9 flex-1" : "size-8",
            lightActive
              ? "bg-brand/40 text-brand-accent"
              : "text-sidebar-muted hover:text-sidebar-fg",
          )}
          aria-label={t("theme.light")}
          aria-pressed={preference === "light"}
          title={t("theme.light")}
        >
          <Sun size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setPreference(preference === "dark" ? "system" : "dark")}
          className={clsx(
            "flex touch-manipulation items-center justify-center rounded-full transition-colors",
            variant === "pill" ? "h-9 flex-1" : "size-8",
            darkActive
              ? "bg-brand/40 text-brand-accent"
              : "text-sidebar-muted hover:text-sidebar-fg",
          )}
          aria-label={t("theme.dark")}
          aria-pressed={preference === "dark"}
          title={t("theme.dark")}
        >
          <Moon size={16} aria-hidden fill={darkActive ? "currentColor" : "none"} />
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cycle();
        }}
        className={buttonClass(
          "ghost",
          "relative z-10 size-10 shrink-0 touch-manipulation rounded-2xl px-0",
        )}
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
      className="inline-flex rounded-full border border-border bg-surface p-1"
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
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition",
              active
                ? "bg-brand/15 text-brand-strong"
                : "text-muted hover:text-fg",
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
