import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { fetchUserAnimelist } from '@/lib/api/jikan-userlist';
import { log } from '@/lib/logger';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';

const BodySchema = z.object({
  username: z.string().trim().min(1).max(40),
  filter: z.enum(['all', 'watching', 'completed', 'plan']).default('all'),
});

/**
 * Bulk-import a user's MyAnimeList library into the current Animeroll
 * account. Skips duplicates (the unique (user_id, mal_id) index does
 * the work). Existing entries' user_score / status / private_notes are
 * preserved untouched — import is additive.
 *
 * Rate-limited to 3/min per user; a single import can hit Jikan up to
 * ~50 times so we don't want users running it on a loop.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'mal-import'), 3, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many imports', undefined, rateLimitHeaders(rl));
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { username, filter } = parsed.data;

  let imported;
  try {
    imported = await fetchUserAnimelist(username, filter);
  } catch (err) {
    if (err instanceof Error && err.message === 'user_not_found') {
      return errorResponse(404, 'user_not_found', `MAL user "${username}" not found`);
    }
    log.error({ username, filter, err }, 'mal_import_failed');
    return errorResponse(502, 'upstream_error', 'MAL is unreachable right now');
  }

  if (imported.length === 0) {
    return NextResponse.json(
      { data: { added: 0, skipped: 0, total: 0, username } },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // Bulk insert with onConflictDoNothing keyed on (user_id, mal_id) — the
  // unique index ensures duplicates don't error and don't overwrite the
  // user's existing score/status/notes.
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
