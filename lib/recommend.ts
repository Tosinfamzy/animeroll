import { type Status } from './db/schema';

/**
 * Content-based recommendations. This is deliberately *not* collaborative
 * filtering — with only the user's own library and per-title metadata, we model
 * taste as favored genres and use MAL's co-recommendation edges as the
 * candidate source. The pure scoring lives here; the Jikan fan-out and cache
 * hydration live in the route.
 */

export interface TasteEntry {
  status: Status;
  userScore: number | null;
  anime: { genres: string[] };
}

export interface TasteProfile {
  /** Genre → accumulated weight from liked entries. */
  genreWeights: Record<string, number>;
  /** How many entries qualified as "liked" and shaped the profile. */
  basis: number;
}

/** A user score at or above this counts as a "like", as does any completion. */
export const LIKE_THRESHOLD = 7;

export function buildTasteProfile(entries: TasteEntry[]): TasteProfile {
  const genreWeights: Record<string, number> = {};
  let basis = 0;
  for (const e of entries) {
    const liked =
      (e.userScore !== null && e.userScore >= LIKE_THRESHOLD) || e.status === 'completed';
    if (!liked) continue;
    basis += 1;
    // A 10 weighs more than a 7; an unscored completion weighs 1.
    const weight = e.userScore !== null ? Math.max(1, e.userScore - LIKE_THRESHOLD + 1) : 1;
    for (const g of e.anime.genres) {
      genreWeights[g] = (genreWeights[g] ?? 0) + weight;
    }
  }
  return { genreWeights, basis };
}

export interface Candidate {
  malId: number;
  title: string;
  imageUrl: string;
  genres: string[];
  meanScore: number | null;
  /** How many of the user's seed titles recommended this candidate. */
  coRecommendCount: number;
}

export interface Recommendation extends Candidate {
  score: number;
  /** Favored genres this candidate shares with the user, strongest first. */
  reasonGenres: string[];
}

const W_CO = 2;
const W_GENRE = 1;
const W_SCORE = 0.3;
const MAX_REASON_GENRES = 3;

/**
 * Rank candidates by co-recommendation strength + genre overlap with the taste
 * profile + a light community-score tiebreaker. Excludes anything already in
 * the library. Deterministic ordering (final tiebreak on malId).
 */
export function rankRecommendations(
  candidates: Candidate[],
  profile: TasteProfile,
  excludeMalIds: Set<number>,
  limit: number,
): Recommendation[] {
  const ranked: Recommendation[] = [];
  for (const c of candidates) {
    if (excludeMalIds.has(c.malId)) continue;
    const matched = c.genres
      .filter((g) => (profile.genreWeights[g] ?? 0) > 0)
      .sort((a, b) => (profile.genreWeights[b] ?? 0) - (profile.genreWeights[a] ?? 0));
    const genreScore = matched.reduce((s, g) => s + (profile.genreWeights[g] ?? 0), 0);
    const score = c.coRecommendCount * W_CO + genreScore * W_GENRE + (c.meanScore ?? 0) * W_SCORE;
    ranked.push({
      ...c,
      score: Math.round(score * 100) / 100,
      reasonGenres: matched.slice(0, MAX_REASON_GENRES),
    });
  }
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.coRecommendCount - a.coRecommendCount ||
      (b.meanScore ?? 0) - (a.meanScore ?? 0) ||
      a.malId - b.malId,
  );
  return ranked.slice(0, limit);
}
