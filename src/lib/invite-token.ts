/** Accepts either the raw invite token or a full invite link and returns the token. */
export function extractInviteToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/invite\/([A-Za-z0-9]+)/);
  return match ? match[1] : trimmed;
}
