import { describe, expect, it } from "vitest";
import { canConvert, convertQuantity, convertQuantityOrThrow, dimensionOf, parseUnit, UnitConversionError } from "./units";

const egg = { unitWeightG: 60, unitVolumeMl: 55 };
const oil = { densityGPerMl: 0.91 };

describe("same-dimension conversion", () => {
  it("converts mass", () => {
    expect(convertQuantityOrThrow(200, "g", "kg")).toBe(0.2);
    expect(convertQuantityOrThrow(1.5, "kg", "g")).toBe(1500);
    expect(convertQuantityOrThrow(250, "g", "g")).toBe(250);
  });

  it("converts volume", () => {
    expect(convertQuantityOrThrow(500, "ml", "l")).toBe(0.5);
    expect(convertQuantityOrThrow(0.25, "l", "ml")).toBe(250);
  });

  it("keeps pieces as pieces", () => {
    expect(convertQuantityOrThrow(3, "pcs", "pcs")).toBe(3);
  });

  it("does not accumulate floating point noise", () => {
    expect(convertQuantityOrThrow(0.1 + 0.2, "kg", "g")).toBe(300);
    expect(convertQuantityOrThrow(0.7, "kg", "g")).toBe(700);
  });

  it("allows zero", () => {
    expect(convertQuantityOrThrow(0, "kg", "g")).toBe(0);
  });
});

describe("product-specific conversion", () => {
  it("converts pieces to mass and back using the unit weight", () => {
    expect(convertQuantityOrThrow(2, "pcs", "g", egg)).toBe(120);
    expect(convertQuantityOrThrow(0.12, "kg", "pcs", egg)).toBe(2);
    expect(convertQuantityOrThrow(90, "g", "pcs", egg)).toBe(1.5);
  });

  it("converts pieces to volume and back using the unit volume", () => {
    expect(convertQuantityOrThrow(2, "pcs", "ml", egg)).toBe(110);
    expect(convertQuantityOrThrow(0.11, "l", "pcs", egg)).toBe(2);
  });

  it("converts mass and volume using the density", () => {
    expect(convertQuantityOrThrow(100, "ml", "g", oil)).toBeCloseTo(91, 9);
    expect(convertQuantityOrThrow(0.91, "kg", "l", oil)).toBeCloseTo(1, 9);
  });
});

describe("unsafe conversions are refused", () => {
  const code = (r: ReturnType<typeof convertQuantity>) => (r.ok ? "ok" : r.error.code);

  it("refuses pieces <-> mass without a unit weight", () => {
    expect(code(convertQuantity(2, "pcs", "g"))).toBe("missing_unit_weight");
    expect(code(convertQuantity(200, "g", "pcs", oil))).toBe("missing_unit_weight");
  });

  it("refuses pieces <-> volume without a unit volume", () => {
    expect(code(convertQuantity(1, "pcs", "ml"))).toBe("missing_unit_volume");
    expect(code(convertQuantity(100, "ml", "pcs", { unitWeightG: 60 }))).toBe("missing_unit_volume");
  });

  it("refuses mass <-> volume without a density and never assumes water", () => {
    expect(code(convertQuantity(100, "ml", "g"))).toBe("missing_density");
    expect(code(convertQuantity(100, "g", "l", egg))).toBe("missing_density");
  });

  it("does not derive a density from piece weight and volume", () => {
    expect(code(convertQuantity(100, "g", "ml", { unitWeightG: 60, unitVolumeMl: 55 }))).toBe("missing_density");
  });

  it("rejects non-positive spec values as missing", () => {
    expect(code(convertQuantity(1, "pcs", "g", { unitWeightG: 0 }))).toBe("missing_unit_weight");
    expect(code(convertQuantity(1, "pcs", "g", { unitWeightG: null }))).toBe("missing_unit_weight");
    expect(code(convertQuantity(1, "g", "ml", { densityGPerMl: -1 }))).toBe("missing_density");
  });

  it("rejects invalid quantities and unknown units", () => {
    expect(code(convertQuantity(-1, "g", "kg"))).toBe("invalid_quantity");
    expect(code(convertQuantity(Number.NaN, "g", "kg"))).toBe("invalid_quantity");
    expect(code(convertQuantity(Number.POSITIVE_INFINITY, "g", "kg"))).toBe("invalid_quantity");
    expect(code(convertQuantity(1, "cup", "g"))).toBe("unknown_unit");
    expect(code(convertQuantity(1, "g", "tbsp"))).toBe("unknown_unit");
  });

  it("explains the failure with a clear message", () => {
    const result = convertQuantity(2, "pcs", "g");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/no unit weight/);
      expect(result.error.from).toBe("pcs");
      expect(result.error.to).toBe("g");
    }
  });

  it("throws a typed error from the throwing variant", () => {
    expect(() => convertQuantityOrThrow(1, "ml", "g")).toThrow(UnitConversionError);
    try {
      convertQuantityOrThrow(1, "ml", "g");
    } catch (e) {
      expect((e as UnitConversionError).code).toBe("missing_density");
    }
  });

  it("canConvert mirrors convertQuantity", () => {
    expect(canConvert("g", "kg")).toBe(true);
    expect(canConvert("pcs", "g")).toBe(false);
    expect(canConvert("pcs", "g", egg)).toBe(true);
  });
});

describe("parseUnit", () => {
  it("normalises common labels, including Romanian", () => {
    expect(parseUnit("Kg")).toBe("kg");
    expect(parseUnit(" buc ")).toBe("pcs");
    expect(parseUnit("bucăți")).toBe("pcs");
    expect(parseUnit("Liters")).toBe("l");
    expect(parseUnit("gr.")).toBe("g");
  });

  it("returns null for unsupported or empty labels", () => {
    expect(parseUnit("cup")).toBeNull();
    expect(parseUnit("")).toBeNull();
    expect(parseUnit(null)).toBeNull();
    expect(parseUnit(undefined)).toBeNull();
  });

  it("knows each dimension", () => {
    expect(dimensionOf("kg")).toBe("mass");
    expect(dimensionOf("ml")).toBe("volume");
    expect(dimensionOf("pcs")).toBe("count");
  });
});
