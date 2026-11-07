import { chartGeometry, seriesByRetailer } from "@/lib/prices/history";
import type { HistoryPoint } from "@/lib/prices/types";
import { formatMoney, toMinor } from "@/lib/money";

const COLORS = ["var(--brand)", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#166534"];

export function PriceHistoryChart({
  points,
  retailers,
  currency,
  locale,
  empty,
}: {
  points: HistoryPoint[];
  retailers: { id: string; name: string }[];
  currency: string;
  locale: string;
  empty: string;
}) {
  const series = seriesByRetailer(points);
  const geo = chartGeometry(series);
  if (!geo) {
    return <p className="text-sm text-muted">{empty}</p>;
  }
  const nameById = new Map(retailers.map((r) => [r.id, r.name]));

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 320 120" className="h-auto w-full max-w-xl" role="img" aria-label="Price history">
        <rect x="0" y="0" width="320" height="120" fill="transparent" />
        {geo.polylines.map((line, i) => (
          <polyline
            key={line.retailerId}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={line.points}
          />
        ))}
      </svg>
      <ul className="flex flex-wrap gap-3 text-xs text-muted">
        {series.map((s, i) => (
          <li key={s.retailerId} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {nameById.get(s.retailerId) ?? s.retailerId}
            <span className="tabular">
              {formatMoney(toMinor(s.points[s.points.length - 1]?.price ?? 0), currency, locale)}
            </span>
          </li>
        ))}
      </ul>
      <p className="tabular text-xs text-muted">
        {formatMoney(toMinor(geo.minPrice), currency, locale)} – {formatMoney(toMinor(geo.maxPrice), currency, locale)}
      </p>
    </div>
  );
}
