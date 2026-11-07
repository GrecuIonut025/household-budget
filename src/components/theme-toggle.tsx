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
}: {
  compact?: boolean;
  /** Use on the dark navy sidebar so the control stays readable. */
  tone?: "default" | "sidebar";
}) {
  const { preference, setPreference, cycle } = useTheme();
  const { t } = useI18n();

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
