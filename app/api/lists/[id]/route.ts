import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { animeCache, entries, listEntries, lists } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { parseGenres } from '@/lib/shares';

const ParamsSchema = z.object({ id: z.string().min(1) });

const PatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteCtx) {
  const userId = getCurrentUserId();
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);

  const list = await db.query.lists.findFirst({
    where: and(eq(lists.id, parsed.data.id), eq(lists.userId, userId)),
  });
  if (!list) return errorResponse(404, 'not_found', 'List not found');

  const memberRows = await db
    .select({ entry: entries, anime: animeCache })
    .from(listEntries)
    .innerJoin(entries, eq(entries.id, listEntries.entryId))
    .innerJoin(animeCache, eq(animeCache.malId, entries.malId))
    .where(eq(listEntries.listId, parsed.data.id))
    .orderBy(desc(listEntries.addedAt));

  const members = memberRows.map((r) => ({
    entry: r.entry,
    anime: { ...r.anime, genres: parseGenres(r.anime.genres) },
    listIds: [parsed.data.id],
  }));
  return NextResponse.json({ data: { list, members } });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const userId = getCurrentUserId();
  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);

  const body: unknown = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const id = paramsParsed.data.id;
  const existing = await db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, userId)),
  });
  if (!existing) return errorResponse(404, 'not_found', 'List not found');

  await db
    .update(lists)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(lists.id, id), eq(lists.userId, userId)));
  const updated = await db.query.lists.findFirst({ where: eq(lists.id, id) });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const userId = getCurrentUserId();
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);
  const id = parsed.data.id;

  const existing = await db.query.lists.findFirst({
    where: and(eq(lists.id, id), eq(lists.userId, userId)),
  });
  if (!existing) return errorResponse(404, 'not_found', 'List not found');

  await db.delete(lists).where(and(eq(lists.id, id), eq(lists.userId, userId)));
  return NextResponse.json({ data: { id, deleted: true } });
}
