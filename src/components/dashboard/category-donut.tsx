import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import type { CategorySlice } from "@/lib/dashboard-charts";

function donutSegments(slices: CategorySlice[], circumference: number) {
  let offset = 0;
  return slices.map((slice) => {
    const length = (slice.percent / 100) * circumference;
    const segment = { ...slice, length, offset };
    offset += length;
    return segment;
  });
}

const PLACEHOLDER_LEGEND = [
  { color: "#8b5cf6" },
  { color: "#3b82f6" },
  { color: "#f59e0b" },
  { color: "#10b981" },
  { color: "#64748b" },
];

export function CategoryDonut({
  title,
  detailsLabel,
  emptyTitle,
  slices,
  centerLabel,
  totalLabel,
  insight,
}: {
  title: string;
  detailsLabel: string;
  emptyTitle: string;
  slices: CategorySlice[];
  centerLabel: string;
  totalLabel: string;
  insight?: string | null;
}) {
  const size = 168;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = donutSegments(slices, circumference);
  const empty = slices.length === 0;

  return (
    <section className="flex min-h-[20rem] flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
        >
          {detailsLabel} <ArrowRight size={12} aria-hidden />
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="text-surface-2"
            />
            {segments.map((slice) => (
              <circle
                key={slice.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={stroke}
                strokeDasharray={`${slice.length} ${circumference - slice.length}`}
                strokeDashoffset={-slice.offset}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <p className="tabular text-base font-semibold text-fg">{totalLabel}</p>
            <p className="text-[11px] text-muted">{centerLabel}</p>
          </div>
        </div>

        {empty ? (
          <ul className="w-full min-w-0 space-y-2.5">
            {PLACEHOLDER_LEGEND.map((row, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.color, opacity: 0.35 }} />
                <span className="h-2.5 min-w-0 flex-1 rounded bg-surface-2" />
                <span className="tabular shrink-0 text-muted/50">—</span>
              </li>
            ))}
            <li className="pt-1 text-center text-xs text-muted">{emptyTitle}</li>
          </ul>
        ) : (
          <ul className="w-full min-w-0 space-y-2.5">
            {slices.slice(0, 6).map((slice) => (
              <li key={slice.id} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="min-w-0 flex-1 truncate text-fg">{slice.label}</span>
                <span className="tabular shrink-0 text-muted">{slice.percent}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-ok-soft px-3 py-2.5 text-sm text-ok">
        <Lightbulb size={16} className="mt-0.5 shrink-0" aria-hidden />
        <p className="leading-snug">{insight ?? emptyTitle}</p>
      </div>
    </section>
  );
}
