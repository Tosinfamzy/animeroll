import { describe, expect, it } from 'vitest';

import { computeStats, type StatsEntry } from './stats';

function entry(p: Partial<StatsEntry>): StatsEntry {
  return {
    status: 'completed',
    userScore: null,
    episodesWatched: 0,
    completedAt: null,
    anime: { genres: [], meanScore: null },
    ...p,
  };
}

describe('computeStats', () => {
  it('returns a zeroed shape for an empty library', () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.meanUserScore).toBeNull();
    expect(s.completionRate).toBe(0);
    expect(s.totalEpisodes).toBe(0);
    expect(s.topGenres).toEqual([]);
    expect(s.scoreDeltaVsCommunity).toBeNull();
    expect(s.completionsByYear).toEqual([]);
    expect(s.byStatus.plan).toBe(0);
    expect(s.scoreDistribution).toHaveLength(10);
  });

  it('counts statuses and sums episodes', () => {
    const s = computeStats([
      entry({ status: 'completed', episodesWatched: 12 }),
      entry({ status: 'watching', episodesWatched: 3 }),
      entry({ status: 'plan', episodesWatched: 0 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.byStatus.completed).toBe(1);
    expect(s.byStatus.watching).toBe(1);
    expect(s.byStatus.plan).toBe(1);
    expect(s.totalEpisodes).toBe(15);
  });

  it('computes mean user score and distribution over scored entries only', () => {
    const s = computeStats([
      entry({ userScore: 8 }),
      entry({ userScore: 10 }),
      entry({ userScore: null }),
    ]);
    expect(s.meanUserScore).toBe(9);
    expect(s.scoreDistribution.find((d) => d.score === 8)?.count).toBe(1);
    expect(s.scoreDistribution.find((d) => d.score === 10)?.count).toBe(1);
    expect(s.scoreDistribution.find((d) => d.score === 5)?.count).toBe(0);
  });

  it('completion rate is completed / non-plan', () => {
    const s = computeStats([
      entry({ status: 'completed' }),
      entry({ status: 'completed' }),
      entry({ status: 'dropped' }),
      entry({ status: 'plan' }), // excluded from denominator
    ]);
    // 2 completed / 3 non-plan
    expect(s.completionRate).toBe(0.67);
  });

  it('completion rate is 0 when every entry is plan', () => {
    const s = computeStats([entry({ status: 'plan' }), entry({ status: 'plan' })]);
    expect(s.completionRate).toBe(0);
  });

  it('tallies genres and breaks ties alphabetically', () => {
    const s = computeStats([
      entry({ anime: { genres: ['Action', 'Comedy'], meanScore: null } }),
      entry({ anime: { genres: ['Action'], meanScore: null } }),
      entry({ anime: { genres: ['Comedy', 'Drama'], meanScore: null } }),
    ]);
    expect(s.topGenres[0]).toEqual({ genre: 'Action', count: 2 });
    expect(s.topGenres[1]).toEqual({ genre: 'Comedy', count: 2 });
    expect(s.topGenres[2]).toEqual({ genre: 'Drama', count: 1 });
  });

  it('computes score delta vs community only when both scores exist', () => {
    const s = computeStats([
      entry({ userScore: 9, anime: { genres: [], meanScore: 7 } }), // +2
      entry({ userScore: 6, anime: { genres: [], meanScore: 8 } }), // -2
      entry({ userScore: 10, anime: { genres: [], meanScore: null } }), // ignored
      entry({ userScore: null, anime: { genres: [], meanScore: 8 } }), // ignored
    ]);
    expect(s.scoreDeltaVsCommunity).toBe(0);
  });

  it('groups completions by UTC year ascending', () => {
    const s = computeStats([
      entry({ status: 'completed', completedAt: '2024-03-01T00:00:00.000Z' }),
      entry({ status: 'completed', completedAt: '2024-11-01T00:00:00.000Z' }),
      entry({ status: 'completed', completedAt: '2026-01-02T00:00:00.000Z' }),
      entry({ status: 'watching', completedAt: null }),
    ]);
    expect(s.completionsByYear).toEqual([
      { year: 2024, count: 2 },
      { year: 2026, count: 1 },
    ]);
  });
});
