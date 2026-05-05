import { NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { animeCache, entries, listEntries } from '@/lib/db/schema';
import { upsertAnimeCache } from '@/lib/db/queries';
import { getAnimeById } from '@/lib/api/jikan';
import { getCurrentUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { parseGenres } from '@/lib/shares';

export async function GET() {
  const userId = getCurrentUserId();
  const rows = await db
    .select({
      entry: entries,
      anime: animeCache,
      listIdsCsv: sql<string | null>`group_concat(${listEntries.listId})`.as('list_ids_csv'),
    })
    .from(entries)
    .innerJoin(animeCache, eq(entries.malId, animeCache.malId))
    .leftJoin(listEntries, eq(listEntries.entryId, entries.id))
    .where(eq(entries.userId, userId))
    .groupBy(entries.id)
    .orderBy(desc(entries.addedAt));

  const data = rows.map((r) => ({
    entry: r.entry,
    anime: { ...r.anime, genres: parseGenres(r.anime.genres) },
    listIds: r.listIdsCsv ? r.listIdsCsv.split(',').filter(Boolean) : [],
  }));
  return NextResponse.json({ data });
}

const PostSchema = z.object({ malId: z.number().int().positive() });

export async function POST(req: Request) {
  const userId = getCurrentUserId();
  const body: unknown = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { malId } = parsed.data;

  const existing = await db.query.entries.findFirst({
    where: and(eq(entries.userId, userId), eq(entries.malId, malId)),
  });
  if (existing) {
    const anime = await db.query.animeCache.findFirst({ where: eq(animeCache.malId, malId) });
    return NextResponse.json(
      {
        data: {
          entry: existing,
          anime: anime ? { ...anime, genres: parseGenres(anime.genres) } : null,
        },
        existed: true,
      },
      { status: 200 },
    );
  }

  const cached = await db.query.animeCache.findFirst({ where: eq(animeCache.malId, malId) });
  if (!cached) {
    try {
      const fresh = await getAnimeById(malId);
      await upsertAnimeCache(fresh);
    } catch {
      return errorResponse(502, 'upstream_error', 'Could not fetch anime metadata');
    }
  }

  const id = crypto.randomUUID();
  await db.insert(entries).values({ id, userId, malId });
  const created = await db.query.entries.findFirst({ where: eq(entries.id, id) });
  const anime = await db.query.animeCache.findFirst({ where: eq(animeCache.malId, malId) });
  if (!created || !anime) return errorResponse(500, 'internal_error', 'Failed to create entry');
  return NextResponse.json(
    {
      data: { entry: created, anime: { ...anime, genres: parseGenres(anime.genres) } },
      existed: false,
    },
    { status: 201 },
  );
}
