import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { animeCache, entries, listEntries, lists, shares } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { buildEntrySnapshot, buildListSnapshot } from '@/lib/shares';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';

const ParamsSchema = z.object({ token: z.string().min(1) });

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/**
 * Re-snapshot a share — rebuilds the snapshot JSON from the creator's
 * current data while keeping the same token, take, and reactions. Used
 * when "I added more entries to the list, send the link again."
 *
 * Trade-off vs. the v1 immutability framing: a re-snapshotted share's
 * preview will change on the recipient's side. Acceptable because it's
 * an explicit creator action, not a passive update.
 *
 * Errors:
 *  - 404 if share missing or not owned by current user
 *  - 410 if the underlying entry/list was deleted (can't rebuild)
 *  - 502 if anime metadata is unavailable (entry shares only)
 */
export async function POST(req: Request, { params }: RouteCtx) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'shares-resnapshot'), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many re-snapshot calls', undefined, rateLimitHeaders(rl));
  }

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);

  const share = await db.query.shares.findFirst({
    where: and(eq(shares.token, parsed.data.token), eq(shares.createdBy, userId)),
  });
  if (!share) return errorResponse(404, 'not_found', 'Share not found');
  if (share.revokedAt) {
    return errorResponse(409, 'revoked', 'Cannot re-snapshot a revoked share');
  }

  let snapshotJson: string;

  if (share.kind === 'entry') {
    if (!share.entryId) {
      return errorResponse(500, 'internal_error', 'Entry share missing entryId');
    }
    const entry = await db.query.entries.findFirst({
      where: and(eq(entries.id, share.entryId), eq(entries.userId, userId)),
    });
    if (!entry) {
      return errorResponse(410, 'gone', 'Original entry has been deleted');
    }
    const anime = await db.query.animeCache.findFirst({
      where: eq(animeCache.malId, entry.malId),
    });
    if (!anime) {
      return errorResponse(502, 'upstream_error', 'Anime metadata unavailable');
    }
    snapshotJson = JSON.stringify(buildEntrySnapshot(entry, anime));
  } else {
    if (!share.listId) {
      return errorResponse(500, 'internal_error', 'List share missing listId');
    }
    const list = await db.query.lists.findFirst({
      where: and(eq(lists.id, share.listId), eq(lists.userId, userId)),
    });
    if (!list) {
      return errorResponse(410, 'gone', 'Original list has been deleted');
    }
    const memberRows = await db
      .select({ entry: entries, anime: animeCache })
      .from(listEntries)
      .innerJoin(entries, eq(entries.id, listEntries.entryId))
      .innerJoin(animeCache, eq(animeCache.malId, entries.malId))
      .where(eq(listEntries.listId, share.listId))
      .orderBy(desc(listEntries.addedAt));
    snapshotJson = JSON.stringify(buildListSnapshot(list, memberRows));
  }

  await db
    .update(shares)
    .set({ snapshot: snapshotJson })
    .where(and(eq(shares.token, parsed.data.token), eq(shares.createdBy, userId)));

  return NextResponse.json(
    { data: { token: parsed.data.token, resnapshottedAt: new Date().toISOString() } },
    { headers: rateLimitHeaders(rl) },
  );
}
