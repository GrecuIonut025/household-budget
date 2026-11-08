import { describe, expect, it } from "vitest";
import { newUuid } from "./id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("newUuid", () => {
  it("returns an RFC 4122 version-4 UUID", () => {
    expect(newUuid()).toMatch(UUID_RE);
  });

  it("returns unique values", () => {
    const a = newUuid();
    const b = newUuid();
    expect(a).not.toBe(b);
  });

  it("works when randomUUID is missing (insecure HTTP)", () => {
    const original = globalThis.crypto.randomUUID;
    // @ts-expect-error intentional override for non-secure context simulation
    globalThis.crypto.randomUUID = undefined;
    try {
      expect(newUuid()).toMatch(UUID_RE);
    } finally {
      globalThis.crypto.randomUUID = original;
    }
  });
});
