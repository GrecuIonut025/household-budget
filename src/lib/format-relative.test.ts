import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/format";

describe("formatRelativeTime", () => {
  it("formats recent times in English", () => {
    const now = Date.parse("2026-11-08T12:00:00.000Z");
    expect(formatRelativeTime("2026-11-08T11:59:30.000Z", "en", now)).toMatch(/second|now/i);
    expect(formatRelativeTime("2026-11-08T11:45:00.000Z", "en", now)).toMatch(/minute/i);
    expect(formatRelativeTime("2026-11-08T09:00:00.000Z", "en", now)).toMatch(/hour/i);
  });
});
