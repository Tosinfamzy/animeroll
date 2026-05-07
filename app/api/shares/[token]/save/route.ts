import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { entries } from '@/lib/db/schema';
import { ensureAnimeCached } from '@/lib/db/queries';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { loadShareByToken } from '@/lib/share-loader';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';

const ParamsSchema = z.object({ token: z.string().min(1) });

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/**
 * Save the anime (or all anime) from a share into the current user's library.
 *
 * - kind=entry → idempotent INSERT keyed on (user_id, mal_id). Returns
 *   { added: boolean, entryId, total: 1 }.
 * - kind=list  → bulk insert each member. Returns
 *   { addedCount, existedCount, total }.
 *
 * Race-safe via the existing unique index on entries(user_id, mal_id):
 * concurrent calls produce deterministic counts (each call sees its own
 * "added" or "already there"; never duplicates).
 */
export async function POST(req: Request, { params }: RouteCtx) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'shares-save'), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many save operations', undefined, rateLimitHeaders(rl));
  }

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);

  const loaded = await loadShareByToken(parsed.data.token);
  if (!loaded) return errorResponse(404, 'not_found', 'Share not found');

  if (loaded.kind === 'entry') {
    const { malId } = loaded.snapshot;
    const anime = await ensureAnimeCached(malId);
    if (!anime) {
      return errorResponse(502, 'upstream_error', 'Could not fetch anime metadata');
    }
    const id = crypto.randomUUID();
    const inserted = await db
      .insert(entries)
      .values({ id, userId, malId })
      .onConflictDoNothing()
      .returning();
    const added = inserted.length > 0;
    return NextResponse.json(
      {
        data: {
          added,
          entryId: added ? inserted[0]?.id ?? null : null,
          total: 1,
        },
      },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // list: bulk save all snapshot members.
  const malIds = loaded.snapshot.entries.map((e) => e.malId);
  let addedCount = 0;
  let existedCount = 0;
  let upstreamFailures = 0;

  for (const malId of malIds) {
    const anime = await ensureAnimeCached(malId);
    if (!anime) {
      upstreamFailures += 1;
      continue;
    }
    const id = crypto.randomUUID();
    const inserted = await db
      .insert(entries)
      .values({ id, userId, malId })
      .onConflictDoNothing()
      .returning();
    if (inserted.length > 0) addedCount += 1;
    else existedCount += 1;
  }

  return NextResponse.json(
    {
      data: {
        addedCount,
        existedCount,
        upstreamFailures,
        total: malIds.length,
      },
    },
    { headers: rateLimitHeaders(rl) },
  );
}
