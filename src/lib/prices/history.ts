import type { HistoryPoint } from "./types";

export interface ChartSeries {
  retailerId: string;
  points: HistoryPoint[];
}

/** Buckets history points by retailer, sorted by time, for the SVG chart. */
export function seriesByRetailer(points: readonly HistoryPoint[]): ChartSeries[] {
  const map = new Map<string, HistoryPoint[]>();
  for (const p of points) {
    if (!(p.price > 0)) continue;
    const list = map.get(p.retailerId) ?? [];
    list.push(p);
    map.set(p.retailerId, list);
  }
  return [...map.entries()]
    .map(([retailerId, pts]) => ({
      retailerId,
      points: [...pts].sort((a, b) => a.observedAt.localeCompare(b.observedAt)),
    }))
    .sort((a, b) => a.retailerId.localeCompare(b.retailerId));
}

export interface ChartGeometry {
  minPrice: number;
  maxPrice: number;
  minTs: number;
  maxTs: number;
  /** SVG polyline points string per series, in viewBox coordinates. */
  polylines: { retailerId: string; points: string }[];
}

export function chartGeometry(series: readonly ChartSeries[], width = 320, height = 120, pad = 8): ChartGeometry | null {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  const prices = all.map((p) => p.price);
  const times = all.map((p) => Date.parse(p.observedAt));
  let minPrice = Math.min(...prices);
  let maxPrice = Math.max(...prices);
  if (minPrice === maxPrice) {
    minPrice = Math.max(0, minPrice - 1);
    maxPrice = maxPrice + 1;
  }
  const minTs = Math.min(...times);
  let maxTs = Math.max(...times);
  if (minTs === maxTs) maxTs = minTs + 1;

  const polylines = series.map((s) => ({
    retailerId: s.retailerId,
    points: s.points
      .map((p) => {
        const x = pad + ((Date.parse(p.observedAt) - minTs) / (maxTs - minTs)) * (width - pad * 2);
        const y = height - pad - ((p.price - minPrice) / (maxPrice - minPrice)) * (height - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" "),
  }));

  return { minPrice, maxPrice, minTs, maxTs, polylines };
}
