import { describe, expect, it } from "vitest";
import { barcodeVariants, gtinCheckDigit, isValidGtin, normalizeBarcode, parseBarcodeList } from "./gtin";

describe("isValidGtin", () => {
  it("accepts valid EAN-13, EAN-8, UPC-A and GTIN-14 codes", () => {
    expect(isValidGtin("5901234123457")).toBe(true);
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("10012345678902")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidGtin("5901234123456")).toBe(false);
    expect(isValidGtin("96385075")).toBe(false);
  });

  it("rejects wrong lengths and non-digits", () => {
    expect(isValidGtin("")).toBe(false);
    expect(isValidGtin("123456789")).toBe(false);
    expect(isValidGtin("59012341234571")).toBe(false);
    expect(isValidGtin("590123412345A")).toBe(false);
    expect(isValidGtin("5901 234123457")).toBe(false);
  });

  it("computes check digits", () => {
    expect(gtinCheckDigit("590123412345")).toBe(7);
    expect(gtinCheckDigit("9638507")).toBe(4);
  });
});

describe("normalizeBarcode", () => {
  it("removes spaces and hyphens", () => {
    expect(normalizeBarcode(" 5901-2341 23457 ")).toBe("5901234123457");
  });
});

describe("barcodeVariants", () => {
  it("links a UPC-A with its EAN-13 spelling", () => {
    expect(barcodeVariants("036000291452").sort()).toEqual(["00036000291452", "0036000291452", "036000291452"].sort());
    expect(barcodeVariants("0036000291452")).toContain("036000291452");
  });

  it("returns nothing for invalid input", () => {
    expect(barcodeVariants("123")).toEqual([]);
  });

  it("keeps an EAN-13 without leading zeros as is", () => {
    expect(barcodeVariants("5901234123457")).toEqual(["5901234123457", "05901234123457"]);
  });
});

describe("parseBarcodeList", () => {
  it("splits, normalises, de-duplicates and separates invalid entries", () => {
    expect(parseBarcodeList("5901234123457\n 5901-234123457, 96385074;123;")).toEqual({
      valid: ["5901234123457", "96385074"],
      invalid: ["123"],
    });
  });

  it("handles empty input", () => {
    expect(parseBarcodeList("  \n ")).toEqual({ valid: [], invalid: [] });
  });
});
