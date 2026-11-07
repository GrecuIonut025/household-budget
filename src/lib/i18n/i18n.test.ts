import { describe, expect, it } from "vitest";
import { en } from "./en";
import { createTranslator } from "./index";
import { categoryLabel } from "./category";
import { ro } from "./ro";

describe("i18n", () => {
  it("has the same keys in every locale", () => {
    expect(Object.keys(ro).sort()).toEqual(Object.keys(en).sort());
  });

  it("has no empty translations", () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(ro)]) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("keeps placeholders consistent between locales", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)(?:,|\})/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ro[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("interpolates parameters", () => {
    expect(createTranslator("en")("dashboard.greeting", { name: "Ana" })).toBe("Hello, Ana");
    expect(createTranslator("ro")("dashboard.greeting", { name: "Ana" })).toBe("Salut, Ana");
  });

  it("handles plural categories per locale", () => {
    const en_ = createTranslator("en");
    expect(en_("common.days", { count: 1 })).toBe("1 day");
    expect(en_("common.days", { count: 5 })).toBe("5 days");
    const ro_ = createTranslator("ro");
    expect(ro_("common.days", { count: 1 })).toBe("1 zi");
    expect(ro_("common.days", { count: 5 })).toBe("5 zile");
    expect(ro_("common.days", { count: 24 })).toBe("24 de zile");
  });

  it("localises built-in categories and keeps custom names", () => {
    const t = createTranslator("ro");
    expect(categoryLabel(t, { name: "Groceries", system_key: "groceries" })).toBe("Cumpărături alimentare");
    expect(categoryLabel(t, { name: "Pets", system_key: null })).toBe("Pets");
    expect(categoryLabel(t, { name: "Weird", system_key: "unknown_key" })).toBe("Weird");
  });
});
