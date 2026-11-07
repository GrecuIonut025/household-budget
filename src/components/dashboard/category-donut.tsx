import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CategorySlice } from "@/lib/dashboard-charts";
import { EmptyState } from "@/components/ui";

function donutSegments(slices: CategorySlice[], circumference: number) {
  let offset = 0;
  return slices.map((slice) => {
    const length = (slice.percent / 100) * circumference;
    const segment = { ...slice, length, offset };
    offset += length;
    return segment;
  });
}

export function CategoryDonut({
  title,
  detailsLabel,
  emptyTitle,
  slices,
  centerLabel,
  totalLabel,
}: {
  title: string;
  detailsLabel: string;
  emptyTitle: string;
  slices: CategorySlice[];
  centerLabel: string;
  totalLabel: string;
}) {
  const size = 168;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = donutSegments(slices, circumference);

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
        >
          {detailsLabel} <ArrowRight size={12} aria-hidden />
        </Link>
      </div>

      {slices.length === 0 ? (
        <EmptyState compact title={emptyTitle} />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
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

          <ul className="w-full min-w-0 space-y-2.5">
            {slices.slice(0, 6).map((slice) => (
              <li key={slice.id} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="min-w-0 flex-1 truncate text-fg">{slice.label}</span>
                <span className="tabular shrink-0 text-muted">{slice.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
