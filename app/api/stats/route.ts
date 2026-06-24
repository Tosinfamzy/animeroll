import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { animeCache, entries } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse } from '@/lib/api/errors';
import { parseGenres } from '@/lib/shares';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';
import { computeStats, type StatsEntry } from '@/lib/stats';

/**
 * Aggregate the caller's whole library into stats. Computed server-side so we
 * don't ship every entry to the client just to fold it. Includes archived
 * entries — the archive is a shelf, not a deletion, and watched history still
 * counts toward totals.
 */
export async function GET() {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'stats-read'), 60, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many requests', undefined, rateLimitHeaders(rl));
  }

  const rows = await db
    .select({ entry: entries, anime: animeCache })
    .from(entries)
    .innerJoin(animeCache, eq(entries.malId, animeCache.malId))
    .where(eq(entries.userId, userId));

  const statsEntries: StatsEntry[] = rows.map((r) => ({
    status: r.entry.status,
    userScore: r.entry.userScore,
    episodesWatched: r.entry.episodesWatched,
    completedAt: r.entry.completedAt?.toISOString() ?? null,
    anime: {
      genres: parseGenres(r.anime.genres),
      meanScore: r.anime.meanScore,
    },
  }));

  return NextResponse.json({ data: computeStats(statsEntries) }, { headers: rateLimitHeaders(rl) });
}
