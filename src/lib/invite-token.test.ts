import { describe, expect, it } from "vitest";
import { extractInviteToken } from "./invite-token";

describe("extractInviteToken", () => {
  const token = "a".repeat(64);
  it("returns raw tokens unchanged", () => {
    expect(extractInviteToken(`  ${token} `)).toBe(token);
  });
  it("extracts the token from an invite link", () => {
    expect(extractInviteToken(`https://app.example.com/invite/${token}?x=1`)).toBe(token);
  });
});
