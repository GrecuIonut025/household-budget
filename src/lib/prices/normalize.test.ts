import { describe, expect, it } from "vitest";
import { jaccardTokens, normaliseProductText, parseSize, sizeCompatible, trigramSimilarity } from "./normalize";

describe("parseSize", () => {
  it("parses metric sizes", () => {
    expect(parseSize("1l")).toEqual({ qty: 1000, unit: "ml", multipack: 1 });
    expect(parseSize("1,5kg")).toEqual({ qty: 1500, unit: "g", multipack: 1 });
    expect(parseSize("500 g")).toEqual({ qty: 500, unit: "g", multipack: 1 });
  });

  it("parses multipacks", () => {
    expect(parseSize("3x330g")).toEqual({ qty: 990, unit: "g", multipack: 3 });
  });

  it("returns null when missing", () => {
    expect(parseSize("lapte")).toBeNull();
    expect(parseSize(null)).toBeNull();
  });
});

describe("normaliseProductText", () => {
  it("strips noise and detects private labels", () => {
    const n = normaliseProductText("NOS*BONI DE TOT LAPTE UHT 1.5% 1L", "Boni");
    expect(n.nameNorm).toContain("boni");
    expect(n.isPrivateLabel).toBe(true);
    expect(n.privateLabelFamily).toBe("auchan");
    expect(n.size).toEqual({ qty: 1000, unit: "ml", multipack: 1 });
  });
});

describe("similarity helpers", () => {
  it("scores identical tokens highly", () => {
    expect(jaccardTokens(["lapte", "uht", "pilos"], ["lapte", "uht", "pilos"])).toBe(1);
    expect(trigramSimilarity("pilos lapte", "pilos lapte")).toBe(1);
  });

  it("compares sizes with tolerance", () => {
    expect(sizeCompatible({ qty: 1000, unit: "ml", multipack: 1 }, 1, "l")).toBe(1);
    expect(sizeCompatible({ qty: 1000, unit: "ml", multipack: 1 }, 500, "g")).toBe(0);
  });
});
