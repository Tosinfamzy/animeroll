import { STATUSES, type Status } from './db/schema';

/** Minimal projection of an entry needed to compute library stats. */
export interface StatsEntry {
  status: Status;
  userScore: number | null;
  episodesWatched: number;
  /** ISO timestamp or null — set when the entry reached `completed`. */
  completedAt: string | null;
  anime: {
    genres: string[];
    meanScore: number | null;
  };
}

export interface Stats {
  total: number;
  byStatus: Record<Status, number>;
  meanUserScore: number | null;
  /** Counts for scores 1..10 (entries with a user score only). */
  scoreDistribution: { score: number; count: number }[];
  /** completed / non-plan entries, 0 when there are no non-plan entries. */
  completionRate: number;
  totalEpisodes: number;
  topGenres: { genre: string; count: number }[];
  /**
   * Mean of (userScore − community meanScore) over entries that have both,
   * rounded to 2dp. Positive => you rate higher than MAL on average. null when
   * no entry has both a user score and a community score.
   */
  scoreDeltaVsCommunity: number | null;
  /** Completions grouped by calendar year of completedAt, ascending. */
  completionsByYear: { year: number; count: number }[];
}

const TOP_GENRES = 8;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyByStatus(): Record<Status, number> {
  return Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
}

/**
 * Pure library aggregation. No DB, no I/O — the route hydrates StatsEntry[] and
 * calls this, and it's unit-tested against fixtures. Archived entries are the
 * caller's choice to include or exclude.
 */
export function computeStats(entries: StatsEntry[]): Stats {
  const byStatus = emptyByStatus();
  const scoreCounts = new Array<number>(11).fill(0); // index 1..10
  const genreCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();

  let scoreSum = 0;
  let scoredCount = 0;
  let deltaSum = 0;
  let deltaCount = 0;
  let totalEpisodes = 0;

  for (const e of entries) {
    byStatus[e.status] += 1;
    totalEpisodes += e.episodesWatched;

    if (e.userScore !== null && e.userScore >= 1 && e.userScore <= 10) {
      scoreSum += e.userScore;
      scoredCount += 1;
      scoreCounts[e.userScore] = (scoreCounts[e.userScore] ?? 0) + 1;
      if (e.anime.meanScore !== null) {
        deltaSum += e.userScore - e.anime.meanScore;
        deltaCount += 1;
      }
    }

    for (const g of e.anime.genres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }

    if (e.completedAt) {
      const year = new Date(e.completedAt).getUTCFullYear();
      if (!Number.isNaN(year)) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    }
  }

  const total = entries.length;
  const nonPlan = total - byStatus.plan;

  const scoreDistribution = Array.from({ length: 10 }, (_, i) => ({
    score: i + 1,
    count: scoreCounts[i + 1] ?? 0,
  }));

  const topGenres = Array.from(genreCounts.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
    .slice(0, TOP_GENRES);

  const completionsByYear = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  return {
    total,
    byStatus,
    meanUserScore: scoredCount > 0 ? round2(scoreSum / scoredCount) : null,
    scoreDistribution,
    completionRate: nonPlan > 0 ? round2(byStatus.completed / nonPlan) : 0,
    totalEpisodes,
    topGenres,
    scoreDeltaVsCommunity: deltaCount > 0 ? round2(deltaSum / deltaCount) : null,
    completionsByYear,
  };
}
