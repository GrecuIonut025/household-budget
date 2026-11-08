import { describe, expect, it } from "vitest";
import { sanitizeEnvValue } from "./env";

describe("sanitizeEnvValue", () => {
  it("trims and unwraps quotes", () => {
    expect(sanitizeEnvValue('  "https://abc.supabase.co"  ')).toBe("https://abc.supabase.co");
    expect(sanitizeEnvValue("'anon-key'")).toBe("anon-key");
  });

  it("strips CR and BOM", () => {
    expect(sanitizeEnvValue("https://abc.supabase.co\r")).toBe("https://abc.supabase.co");
    expect(sanitizeEnvValue("\uFEFFhttps://abc.supabase.co")).toBe("https://abc.supabase.co");
  });

  it("treats empty and placeholders as missing", () => {
    expect(sanitizeEnvValue("")).toBeNull();
    expect(sanitizeEnvValue("   ")).toBeNull();
    expect(sanitizeEnvValue("...")).toBeNull();
    expect(sanitizeEnvValue("your-project")).toBeNull();
    expect(sanitizeEnvValue("<anon key>")).toBeNull();
  });
});
