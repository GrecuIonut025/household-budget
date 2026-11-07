import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("allows internal paths", () => {
    expect(safeNextPath("/transactions?month=2026-11")).toBe("/transactions?month=2026-11");
  });
  it("rejects external and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });
  it("avoids redirect loops", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
