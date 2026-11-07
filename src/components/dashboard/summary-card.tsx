import clsx from "clsx";
import type { ReactNode } from "react";

const TONES = {
  green: "text-ok bg-ok/15",
  blue: "text-accent-blue bg-accent-blue/15",
  purple: "text-accent-purple bg-accent-purple/15",
  orange: "text-accent-orange bg-accent-orange/15",
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
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={clsx(
                "inline-flex size-9 items-center justify-center rounded-[var(--radius-md)]",
                TONES[tone],
              )}
            >
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
