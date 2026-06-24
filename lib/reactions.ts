import type { ReactionKind } from './db/schema';

export interface ReactionCounts {
  heart: number;
  eyes: number;
  nope: number;
}

export interface ReactionSummary {
  /** Total reactions across all shares passed in. */
  totalReactions: number;
  /** How many shares were considered. */
  totalShares: number;
  /** Shares that have at least one reaction. */
  sharesWithReactions: number;
  byKind: ReactionCounts;
  /** Token of the single most-reacted share, or null if none have reactions. */
  topShareToken: string | null;
}

interface SummarizableShare {
  token: string;
  counts: ReactionCounts;
}

const ZERO: ReactionCounts = { heart: 0, eyes: 0, nope: 0 };

function total(c: ReactionCounts): number {
  return c.heart + c.eyes + c.nope;
}

/**
 * Pure rollup over a creator's shares. Kept free of DB/React so it can be
 * unit-tested and reused by both the server route and the client header.
 * Ties on top-share are broken by first-seen (caller controls ordering).
 */
export function summarizeReactions(shares: SummarizableShare[]): ReactionSummary {
  const byKind: ReactionCounts = { ...ZERO };
  let sharesWithReactions = 0;
  let topShareToken: string | null = null;
  let topCount = 0;

  for (const s of shares) {
    byKind.heart += s.counts.heart;
    byKind.eyes += s.counts.eyes;
    byKind.nope += s.counts.nope;
    const t = total(s.counts);
    if (t > 0) sharesWithReactions += 1;
    if (t > topCount) {
      topCount = t;
      topShareToken = s.token;
    }
  }

  return {
    totalReactions: total(byKind),
    totalShares: shares.length,
    sharesWithReactions,
    byKind,
    topShareToken,
  };
}

/** Tally a flat list of reaction kinds into counts. Used by the drill-down. */
export function tallyReactionKinds(kinds: ReactionKind[]): ReactionCounts {
  const counts: ReactionCounts = { ...ZERO };
  for (const k of kinds) counts[k] += 1;
  return counts;
}
