import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { fetchAniListAnimelist } from '@/lib/api/anilist-userlist';
import { log } from '@/lib/logger';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';

const BodySchema = z.object({
  username: z.string().trim().min(1).max(40),
  filter: z.enum(['all', 'watching', 'completed', 'plan']).default('all'),
});

/**
 * Bulk-import a user's AniList library into the current Animeroll account.
 * Mirrors /api/import/mal: additive, dedupes via the unique (user_id, mal_id)
 * index, preserves existing entries' score/status/notes. Entries AniList can't
 * map to a MAL id are dropped (the whole app keys on malId).
 *
 * Rate-limited to 3/min per user.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'anilist-import'), 3, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many imports', undefined, rateLimitHeaders(rl));
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { username, filter } = parsed.data;

  let imported;
  try {
    imported = await fetchAniListAnimelist(username, filter);
  } catch (err) {
    if (err instanceof Error && err.message === 'user_not_found') {
      return errorResponse(404, 'user_not_found', `AniList user "${username}" not found`);
    }
    log.error({ username, filter, err }, 'anilist_import_failed');
    return errorResponse(502, 'upstream_error', 'AniList is unreachable right now');
  }

  if (imported.length === 0) {
    return NextResponse.json(
      { data: { added: 0, skipped: 0, total: 0, username } },
      { headers: rateLimitHeaders(rl) },
    );
  }

  const rows = imported.map((e) => ({
    id: crypto.randomUUID(),
    userId,
    malId: e.malId,
    status: e.status,
    userScore: e.score,
    episodesWatched: e.episodesWatched,
  }));
  const insertedRows = await db
    .insert(entries)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: entries.id });

  const added = insertedRows.length;
  const skipped = imported.length - added;

  return NextResponse.json(
    { data: { added, skipped, total: imported.length, username } },
    { headers: rateLimitHeaders(rl) },
  );
}
