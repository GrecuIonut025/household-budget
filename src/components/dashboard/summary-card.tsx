import clsx from "clsx";
import type { ReactNode } from "react";

const TONES = {
  green: {
    card: "bg-card-green border-ok/15",
    icon: "bg-ok/15 text-ok",
    wave: "var(--ok)",
  },
  blue: {
    card: "bg-card-blue border-accent-blue/15",
    icon: "bg-accent-blue/15 text-accent-blue",
    wave: "var(--accent-blue)",
  },
  purple: {
    card: "bg-card-purple border-accent-purple/15",
    icon: "bg-accent-purple/15 text-accent-purple",
    wave: "var(--accent-purple)",
  },
  orange: {
    card: "bg-card-orange border-accent-orange/15",
    icon: "bg-accent-orange/15 text-accent-orange",
    wave: "var(--accent-orange)",
  },
} as const;

export function SummaryCard({
  tone,
  icon,
  label,
  value,
  hint,
  trailing,
  action,
}: {
  tone: keyof typeof TONES;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
  action?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section
      className={clsx(
        "relative min-h-[8.5rem] overflow-hidden rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-card)] sm:p-5",
        t.card,
      )}
    >
      <svg
        className="pointer-events-none absolute -bottom-1 -right-2 h-16 w-36 opacity-35"
        viewBox="0 0 160 64"
        aria-hidden
      >
        <path
          d="M0 40 C28 18 44 54 72 36 S120 8 160 28 L160 64 L0 64 Z"
          fill={t.wave}
          opacity="0.35"
        />
        <path
          d="M0 48 C36 28 52 58 84 42 S128 22 160 40"
          fill="none"
          stroke={t.wave}
          strokeWidth="3"
          opacity="0.55"
        />
      </svg>
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className={clsx("inline-flex size-9 items-center justify-center rounded-[var(--radius-md)]", t.icon)}>
              {icon}
            </span>
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{label}</p>
            {action}
          </div>
          <div className="tabular text-2xl font-semibold tracking-tight text-fg">{value}</div>
          {hint ? <div className="mt-1.5 text-xs text-muted">{hint}</div> : null}
        </div>
        {trailing}
      </div>
    </section>
  );
}
