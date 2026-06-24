import { describe, expect, it } from 'vitest';

import { summarizeReactions, tallyReactionKinds } from './reactions';

const c = (heart: number, eyes: number, nope: number) => ({ heart, eyes, nope });

describe('summarizeReactions', () => {
  it('returns a zeroed summary for no shares', () => {
    expect(summarizeReactions([])).toEqual({
      totalReactions: 0,
      totalShares: 0,
      sharesWithReactions: 0,
      byKind: { heart: 0, eyes: 0, nope: 0 },
      topShareToken: null,
    });
  });

  it('counts shares with zero reactions toward totalShares only', () => {
    const s = summarizeReactions([
      { token: 'a', counts: c(0, 0, 0) },
      { token: 'b', counts: c(0, 0, 0) },
    ]);
    expect(s.totalShares).toBe(2);
    expect(s.sharesWithReactions).toBe(0);
    expect(s.totalReactions).toBe(0);
    expect(s.topShareToken).toBeNull();
  });

  it('aggregates by kind and picks the most-reacted share', () => {
    const s = summarizeReactions([
      { token: 'a', counts: c(1, 0, 0) },
      { token: 'b', counts: c(3, 2, 1) },
      { token: 'c', counts: c(0, 0, 0) },
    ]);
    expect(s.byKind).toEqual({ heart: 4, eyes: 2, nope: 1 });
    expect(s.totalReactions).toBe(7);
    expect(s.sharesWithReactions).toBe(2);
    expect(s.topShareToken).toBe('b');
  });

  it('keeps the first share on a top-count tie (caller controls order)', () => {
    const s = summarizeReactions([
      { token: 'first', counts: c(2, 0, 0) },
      { token: 'second', counts: c(0, 2, 0) },
    ]);
    expect(s.topShareToken).toBe('first');
  });
});

describe('tallyReactionKinds', () => {
  it('tallies a flat list', () => {
    expect(tallyReactionKinds(['heart', 'heart', 'eyes', 'nope'])).toEqual({
      heart: 2,
      eyes: 1,
      nope: 1,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(tallyReactionKinds([])).toEqual({ heart: 0, eyes: 0, nope: 0 });
  });
});
