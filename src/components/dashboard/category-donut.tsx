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
  const stroke = 12;
  const radius = 38;
  const view = 100;
  const circumference = 2 * Math.PI * radius;
  const segments = donutSegments(slices, circumference);

  return (
    <section className="dashboard-card flex flex-col justify-between p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 text-xs font-medium text-purple-400 transition hover:text-purple-300"
        >
          {detailsLabel} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      {slices.length === 0 ? (
        <EmptyState compact title={emptyTitle} />
      ) : (
        <>
          <div className="relative mx-auto my-2 flex size-44 items-center justify-center">
            <svg className="size-full -rotate-90" viewBox={`0 0 ${view} ${view}`} aria-hidden>
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="var(--chart-track)"
                strokeWidth={stroke}
              />
              {segments.map((slice) => (
                <circle
                  key={slice.id}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${slice.length} ${circumference - slice.length}`}
                  strokeDashoffset={-slice.offset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-lg font-extrabold leading-tight text-fg">{totalLabel}</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                {centerLabel}
              </span>
            </div>
          </div>

          <ul className="flex flex-col gap-2 border-t border-border-soft pt-2">
            {slices.slice(0, 5).map((slice) => (
              <li key={slice.id} className="flex items-center justify-between text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: slice.color }}
                  />
                  <span className="truncate text-muted">{slice.label}</span>
                </div>
                <span className="tabular font-semibold text-fg">{slice.percent}%</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {insight ? (
        <p className="mt-4 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
          {insight}
        </p>
      ) : null}
    </section>
  );
}
