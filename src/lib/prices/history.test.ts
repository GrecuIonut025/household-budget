import { describe, expect, it } from "vitest";
import { chartGeometry, seriesByRetailer } from "./history";

describe("price history chart", () => {
  it("builds series and geometry", () => {
    const series = seriesByRetailer([
      { observedAt: "2026-11-01T00:00:00Z", price: 5, retailerId: "r1", isPromo: false, source: "manual" },
      { observedAt: "2026-11-05T00:00:00Z", price: 4.5, retailerId: "r1", isPromo: true, source: "adapter" },
      { observedAt: "2026-11-03T00:00:00Z", price: 6, retailerId: "r2", isPromo: false, source: "manual" },
    ]);
    expect(series).toHaveLength(2);
    expect(series[0].points).toHaveLength(2);
    const geo = chartGeometry(series);
    expect(geo).not.toBeNull();
    expect(geo!.polylines[0].points.split(" ").length).toBeGreaterThanOrEqual(1);
  });
});
