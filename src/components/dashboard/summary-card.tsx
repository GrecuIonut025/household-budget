import clsx from "clsx";
import type { ReactNode } from "react";

const TONES = {
  green: "bg-card-green text-ok",
  blue: "bg-card-blue text-accent-blue",
  purple: "bg-card-purple text-accent-purple",
  orange: "bg-card-orange text-accent-orange",
} as const;

export function SummaryCard({
  tone,
  icon,
  label,
  value,
  hint,
  trailing,
}: {
  tone: keyof typeof TONES;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-[var(--radius-lg)] border border-border/60 p-4 shadow-[var(--shadow-card)] sm:p-5",
        TONES[tone].split(" ")[0],
      )}
    >
      <div
        className="pointer-events-none absolute -bottom-8 -right-6 size-28 rounded-full opacity-30 blur-2xl"
        style={{
          background:
            tone === "green"
              ? "var(--ok)"
              : tone === "blue"
                ? "var(--accent-blue)"
                : tone === "purple"
                  ? "var(--accent-purple)"
                  : "var(--accent-orange)",
        }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={clsx(
                "inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-surface/80",
                TONES[tone].split(" ").slice(1).join(" "),
              )}
            >
              {icon}
            </span>
            <p className="text-xs font-medium text-muted">{label}</p>
          </div>
          <p className="tabular text-2xl font-semibold tracking-tight text-fg">{value}</p>
          {hint ? <div className="mt-1.5 text-xs text-muted">{hint}</div> : null}
        </div>
        {trailing}
      </div>
    </section>
  );
}
