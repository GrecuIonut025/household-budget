import clsx from "clsx";
import type { ReactNode } from "react";

const TONES = {
  green: {
    chip: "bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25",
    value: "text-ok",
  },
  blue: {
    chip: "bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-lg shadow-cyan-600/25",
    value: "text-fg",
  },
  purple: {
    chip: "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30",
    value: "text-ok",
  },
  orange: {
    chip: "bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25",
    value: "text-fg",
  },
} as const;

export function SummaryCard({
  tone,
  icon,
  label,
  value,
  hint,
  trailing,
  iconVariant = "chip",
}: {
  tone: keyof typeof TONES;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
  iconVariant?: "chip" | "plain";
}) {
  const styles = TONES[tone];
  return (
    <section className="dashboard-card flex items-center justify-between p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={clsx(
            "inline-flex size-12 shrink-0 items-center justify-center",
            iconVariant === "chip" && `rounded-2xl ${styles.chip}`,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p
            className={clsx(
              "tabular mt-0.5 truncate text-xl font-bold tracking-tight",
              styles.value,
            )}
          >
            {value}
          </p>
          {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
        </div>
      </div>
      {trailing}
    </section>
  );
}
