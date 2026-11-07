import { describe, expect, it } from "vitest";
import { formatMoney, fromMinor, parseMoneyInput, toMinor } from "./money";

describe("money", () => {
  it("converts to and from minor units without float drift", () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor("19.99")).toBe(1999);
    expect(toMinor(null)).toBe(0);
    expect(toMinor("abc")).toBe(0);
    expect(fromMinor(1999)).toBe(19.99);
  });

  it("parses Romanian and English style input", () => {
    expect(parseMoneyInput("12,5")).toBe(1250);
    expect(parseMoneyInput("1.234,56")).toBe(123456);
    expect(parseMoneyInput("1,234.56")).toBe(123456);
    expect(parseMoneyInput(" 7 ")).toBe(700);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("12.345")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
  });

  it("formats with the household currency and locale", () => {
    expect(formatMoney(123456, "RON", "en")).toContain("1,234.56");
    expect(formatMoney(123456, "RON", "ro")).toMatch(/1\.234,56/);
    expect(formatMoney(123456, "RON", "ro")).toContain("RON");
  });
});
