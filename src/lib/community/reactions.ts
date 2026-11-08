export const REACTION_KINDS = ["like", "useful", "love"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export function isReactionKind(value: unknown): value is ReactionKind {
  return typeof value === "string" && (REACTION_KINDS as readonly string[]).includes(value);
}

export type ReactionCounts = Record<ReactionKind, number>;

export function emptyReactionCounts(): ReactionCounts {
  return { like: 0, useful: 0, love: 0 };
}

export function totalReactions(counts: ReactionCounts): number {
  return counts.like + counts.useful + counts.love;
}
