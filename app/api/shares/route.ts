import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  animeCache,
  entries,
  listEntries,
  lists,
  shares,
  SHARE_KINDS,
} from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import {
  buildEntrySnapshot,
  buildListSnapshot,
  generateShareToken,
  shareUrl,
} from '@/lib/shares';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

const BodySchema = z
  .object({
    kind: z.enum(SHARE_KINDS),
    entryId: z.string().min(1).optional(),
    listId: z.string().min(1).optional(),
    take: z.string().trim().max(280).optional(),
  })
  .refine(
    (v) =>
      (v.kind === 'entry' && !!v.entryId && !v.listId) ||
      (v.kind === 'list' && !!v.listId && !v.entryId),
    { message: 'Must provide exactly entryId for kind=entry or listId for kind=list' },
  );

export async function POST(req: Request) {
  const userId = getCurrentUserId();

  const rl = checkRateLimit(clientKeyFromRequest(req, 'shares-create'), 10, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many shares created', undefined, rateLimitHeaders(rl));
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const take = parsed.data.take?.trim() || null;
  const token = generateShareToken();

  if (parsed.data.kind === 'entry') {
    const entryId = parsed.data.entryId!;
    const entry = await db.query.entries.findFirst({
      where: and(eq(entries.id, entryId), eq(entries.userId, userId)),
    });
    if (!entry) return errorResponse(404, 'not_found', 'Entry not found');
    const anime = await db.query.animeCache.findFirst({
      where: eq(animeCache.malId, entry.malId),
    });
    if (!anime) return errorResponse(500, 'internal_error', 'Anime cache missing');
    const snapshot = buildEntrySnapshot(entry, anime);
    await db.insert(shares).values({
      token,
      kind: 'entry',
      entryId: entry.id,
      take,
      snapshot: JSON.stringify(snapshot),
      createdBy: userId,
    });
  } else {
    const listId = parsed.data.listId!;
    const list = await db.query.lists.findFirst({
      where: and(eq(lists.id, listId), eq(lists.userId, userId)),
    });
    if (!list) return errorResponse(404, 'not_found', 'List not found');
    const memberRows = await db
      .select({ entry: entries, anime: animeCache })
      .from(listEntries)
      .innerJoin(entries, eq(entries.id, listEntries.entryId))
      .innerJoin(animeCache, eq(animeCache.malId, entries.malId))
      .where(eq(listEntries.listId, listId))
      .orderBy(desc(listEntries.addedAt));
    const snapshot = buildListSnapshot(list, memberRows);
    await db.insert(shares).values({
      token,
      kind: 'list',
      listId: list.id,
      take,
      snapshot: JSON.stringify(snapshot),
      createdBy: userId,
    });
  }

  const url = shareUrl(token, parsed.data.kind);
  return NextResponse.json(
    { data: { token, url, kind: parsed.data.kind } },
    { status: 201, headers: rateLimitHeaders(rl) },
  );
}
