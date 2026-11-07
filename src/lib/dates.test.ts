import { describe, expect, it } from "vitest";
import { addDays, diffDays, isValidISODate, isValidMonth, monthRange, shiftMonth, todayInTimezone } from "./dates";

describe("dates", () => {
  it("adds and diffs days across month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-11-01", "2026-11-30")).toBe(29);
    expect(diffDays("2026-11-07", "2026-11-01")).toBe(-6);
  });

  it("computes month ranges and shifts", () => {
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("validates input", () => {
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-11")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-02-28")).toBe(true);
  });

  it("resolves today in a timezone", () => {
    const instant = new Date("2026-11-07T23:30:00Z");
    expect(todayInTimezone("Europe/Bucharest", instant)).toBe("2026-11-08");
    expect(todayInTimezone("UTC", instant)).toBe("2026-11-07");
  });
});
