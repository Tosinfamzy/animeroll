import { NextResponse } from 'next/server';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { animeCache, entries, listEntries } from '@/lib/db/schema';
import { ensureAnimeCached } from '@/lib/db/queries';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { parseGenres } from '@/lib/shares';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

interface Cursor {
  /** ms-since-epoch of the entry's added_at */
  ts: number;
  id: string;
}

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function decodeCursor(s: string): Cursor | null {
  try {
    const obj: unknown = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
    if (typeof obj !== 'object' || obj === null) return null;
    const o = obj as Record<string, unknown>;
    if (typeof o.ts !== 'number' || typeof o.id !== 'string') return null;
    return { ts: o.ts, id: o.id };
  } catch {
    return null;
  }
}

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().optional(),
});

export async function GET(req: Request) {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const queryParsed = QuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  });
  if (!queryParsed.success) return validationError(queryParsed.error);
  const { limit, cursor } = queryParsed.data;
  const cur = cursor ? decodeCursor(cursor) : null;

  // Order is (added_at DESC, id DESC) so we can use a stable composite cursor.
  // Fetch limit+1 to determine if a `nextCursor` should be emitted.
  const where = cur
    ? and(
        eq(entries.userId, userId),
        or(
          lt(entries.addedAt, new Date(cur.ts)),
          and(eq(entries.addedAt, new Date(cur.ts)), lt(entries.id, cur.id)),
        ),
      )
    : eq(entries.userId, userId);

  const rows = await db
    .select({
      entry: entries,
      anime: animeCache,
      listIdsCsv: sql<string | null>`group_concat(${listEntries.listId})`.as('list_ids_csv'),
    })
    .from(entries)
    .innerJoin(animeCache, eq(entries.malId, animeCache.malId))
    .leftJoin(listEntries, eq(listEntries.entryId, entries.id))
    .where(where)
    .groupBy(entries.id)
    .orderBy(desc(entries.addedAt), desc(entries.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ ts: last.entry.addedAt.getTime(), id: last.entry.id })
      : null;

  const data = visible.map((r) => ({
    entry: r.entry,
    anime: { ...r.anime, genres: parseGenres(r.anime.genres) },
    listIds: r.listIdsCsv ? r.listIdsCsv.split(',').filter(Boolean) : [],
  }));
  return NextResponse.json({ data, nextCursor });
}

const PostSchema = z.object({ malId: z.number().int().positive() });

export async function POST(req: Request) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(clientKeyFromRequest(req, 'entries-write'), 60, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many entry writes', undefined, rateLimitHeaders(rl));
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { malId } = parsed.data;

  // Ensure the FK target exists (idempotent — upsertAnimeCache handles concurrent calls).
  const anime = await ensureAnimeCached(malId);
  if (!anime) return errorResponse(502, 'upstream_error', 'Could not fetch anime metadata');

  // Race-safe insert: two concurrent POSTs with the same (user_id, mal_id) won't both succeed.
  // The unique index on (user_id, mal_id) handles the conflict; ON CONFLICT DO NOTHING means
  // we don't error, and `.returning()` distinguishes "fresh insert" from "already existed".
  const id = crypto.randomUUID();
  const inserted = await db
    .insert(entries)
    .values({ id, userId, malId })
    .onConflictDoNothing()
    .returning();

  const animeView = { ...anime, genres: parseGenres(anime.genres) };

  if (inserted.length > 0) {
    return NextResponse.json(
      { data: { entry: inserted[0], anime: animeView }, existed: false },
      { status: 201, headers: rateLimitHeaders(rl) },
    );
  }

  // Conflict: a row already exists for (userId, malId). Read and return it.
  const existing = await db.query.entries.findFirst({
    where: and(eq(entries.userId, userId), eq(entries.malId, malId)),
  });
  if (!existing) {
    // Should not happen — the conflict means a row exists by the unique index.
    return errorResponse(500, 'internal_error', 'Entry conflict but row not found');
  }
  return NextResponse.json(
    { data: { entry: existing, anime: animeView }, existed: true },
    { status: 200, headers: rateLimitHeaders(rl) },
  );
}
