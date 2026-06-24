import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { animeCache, entries } from '@/lib/db/schema';
import { ensureAnimeCached } from '@/lib/db/queries';
import { requireUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/api/errors';
import { parseGenres } from '@/lib/shares';
import { fetchRecommendedMalIds } from '@/lib/api/jikan-recommend';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';
import {
  LIKE_THRESHOLD,
  buildTasteProfile,
  rankRecommendations,
  type Candidate,
  type TasteEntry,
} from '@/lib/recommend';

// Bounds on the Jikan fan-out (each call ~one cached-or-network request):
// at most SEED_LIMIT + CANDIDATE_LIMIT upstream calls, cached for 7 days after.
const SEED_LIMIT = 6;
const CANDIDATE_LIMIT = 15;
const RESULT_LIMIT = 12;

/**
 * Content-based recommendations: seed from the user's liked titles, gather
 * MAL's co-recommendation edges, then rank by co-recommendation strength +
 * genre overlap with the user's taste profile. Cold-starts gracefully when the
 * library is too thin to seed from.
 */
export async function GET() {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'recommendations'), 20, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many requests', undefined, rateLimitHeaders(rl));
  }

  const rows = await db
    .select({ entry: entries, anime: animeCache })
    .from(entries)
    .innerJoin(animeCache, eq(entries.malId, animeCache.malId))
    .where(eq(entries.userId, userId));

  const tasteEntries: TasteEntry[] = rows.map((r) => ({
    status: r.entry.status,
    userScore: r.entry.userScore,
    anime: { genres: parseGenres(r.anime.genres) },
  }));
  const excludeMalIds = new Set(rows.map((r) => r.entry.malId));

  // Seeds: liked titles (completed or scored ≥ threshold), best first.
  const seeds = rows
    .filter(
      (r) =>
        r.entry.status === 'completed' ||
        (r.entry.userScore !== null && r.entry.userScore >= LIKE_THRESHOLD),
    )
    .sort((a, b) => (b.entry.userScore ?? 0) - (a.entry.userScore ?? 0))
    .slice(0, SEED_LIMIT)
    .map((r) => r.entry.malId);

  if (seeds.length === 0) {
    return NextResponse.json(
      { data: { recommendations: [], coldStart: true } },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // Tally co-recommendation frequency across seeds, skipping library titles.
  const coCount = new Map<number, number>();
  for (const seed of seeds) {
    const recommended = await fetchRecommendedMalIds(seed);
    for (const malId of recommended) {
      if (excludeMalIds.has(malId)) continue;
      coCount.set(malId, (coCount.get(malId) ?? 0) + 1);
    }
  }

  const topCandidateIds = Array.from(coCount.entries())
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, CANDIDATE_LIMIT)
    .map(([malId]) => malId);

  // Hydrate metadata (cache hit, or a single Jikan fetch) for ranking + display.
  const candidates: Candidate[] = [];
  for (const malId of topCandidateIds) {
    const row = await ensureAnimeCached(malId);
    if (!row) continue;
    candidates.push({
      malId,
      title: row.title,
      imageUrl: row.imageUrl,
      genres: parseGenres(row.genres),
      meanScore: row.meanScore,
      coRecommendCount: coCount.get(malId) ?? 0,
    });
  }

  const profile = buildTasteProfile(tasteEntries);
  const recommendations = rankRecommendations(candidates, profile, excludeMalIds, RESULT_LIMIT);

  return NextResponse.json(
    { data: { recommendations, coldStart: false } },
    { headers: rateLimitHeaders(rl) },
  );
}
