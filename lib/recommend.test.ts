import { describe, expect, it } from 'vitest';

import {
  buildTasteProfile,
  rankRecommendations,
  type Candidate,
  type TasteEntry,
} from './recommend';

const te = (p: Partial<TasteEntry>): TasteEntry => ({
  status: 'completed',
  userScore: null,
  anime: { genres: [] },
  ...p,
});

describe('buildTasteProfile', () => {
  it('ignores entries that are not liked', () => {
    const p = buildTasteProfile([
      te({ status: 'plan', userScore: null, anime: { genres: ['Action'] } }),
      te({ status: 'dropped', userScore: 4, anime: { genres: ['Action'] } }),
    ]);
    expect(p.basis).toBe(0);
    expect(p.genreWeights).toEqual({});
  });

  it('counts completions and high scores, weighting by score', () => {
    const p = buildTasteProfile([
      te({ status: 'completed', userScore: null, anime: { genres: ['Action'] } }), // weight 1
      te({ status: 'watching', userScore: 10, anime: { genres: ['Action', 'Drama'] } }), // weight 4
    ]);
    expect(p.basis).toBe(2);
    expect(p.genreWeights.Action).toBe(5);
    expect(p.genreWeights.Drama).toBe(4);
  });
});

describe('rankRecommendations', () => {
  const cand = (p: Partial<Candidate>): Candidate => ({
    malId: 1,
    title: 'X',
    imageUrl: '',
    genres: [],
    meanScore: null,
    coRecommendCount: 0,
    ...p,
  });

  const profile = { genreWeights: { Action: 3, Drama: 1 }, basis: 5 };

  it('excludes library titles', () => {
    const out = rankRecommendations(
      [cand({ malId: 1, coRecommendCount: 5 })],
      profile,
      new Set([1]),
      10,
    );
    expect(out).toHaveLength(0);
  });

  it('ranks by co-recommendation, then genre overlap, and reports matched genres', () => {
    const out = rankRecommendations(
      [
        cand({ malId: 10, genres: ['Action'], coRecommendCount: 3, meanScore: 7 }),
        cand({ malId: 11, genres: ['Action', 'Drama'], coRecommendCount: 1, meanScore: 9 }),
        cand({ malId: 12, genres: ['Comedy'], coRecommendCount: 0, meanScore: 8 }),
      ],
      profile,
      new Set(),
      10,
    );
    expect(out.map((r) => r.malId)).toEqual([10, 11, 12]);
    expect(out[0]?.reasonGenres).toEqual(['Action']);
    expect(out[1]?.reasonGenres).toEqual(['Action', 'Drama']);
    expect(out[2]?.reasonGenres).toEqual([]);
  });

  it('honors the limit', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      cand({ malId: 100 + i, genres: ['Action'], coRecommendCount: i }),
    );
    expect(rankRecommendations(candidates, profile, new Set(), 5)).toHaveLength(5);
  });
});
