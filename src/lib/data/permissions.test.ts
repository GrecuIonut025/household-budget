import { describe, expect, it } from "vitest";
import { canWrite, isAdmin } from "./types";

describe("role permissions", () => {
  it("viewers are read-only", () => {
    expect(canWrite("viewer")).toBe(false);
    expect(isAdmin("viewer")).toBe(false);
  });
  it("members write but do not administer", () => {
    expect(canWrite("member")).toBe(true);
    expect(isAdmin("member")).toBe(false);
  });
  it("admins and owners do both", () => {
    for (const role of ["admin", "owner"] as const) {
      expect(canWrite(role)).toBe(true);
      expect(isAdmin(role)).toBe(true);
    }
  });
});
