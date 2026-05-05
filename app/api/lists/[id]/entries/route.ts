import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { entries, listEntries, lists } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';

const ParamsSchema = z.object({ id: z.string().min(1) });
const BodySchema = z.object({ entryId: z.string().min(1) });

interface RouteCtx {
  params: Promise<{ id: string }>;
}

async function ensureOwnedList(userId: string, listId: string) {
  return db.query.lists.findFirst({
    where: and(eq(lists.id, listId), eq(lists.userId, userId)),
  });
}

async function ensureOwnedEntry(userId: string, entryId: string) {
  return db.query.entries.findFirst({
    where: and(eq(entries.id, entryId), eq(entries.userId, userId)),
  });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const userId = getCurrentUserId();
  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);

  const body: unknown = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const list = await ensureOwnedList(userId, paramsParsed.data.id);
  if (!list) return errorResponse(404, 'not_found', 'List not found');
  const entry = await ensureOwnedEntry(userId, parsed.data.entryId);
  if (!entry) return errorResponse(404, 'not_found', 'Entry not found');

  await db
    .insert(listEntries)
    .values({ listId: list.id, entryId: entry.id })
    .onConflictDoNothing();
  return NextResponse.json(
    { data: { listId: list.id, entryId: entry.id } },
    { status: 201 },
  );
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const userId = getCurrentUserId();
  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);

  const url = new URL(req.url);
  const entryId = url.searchParams.get('entryId') ?? '';
  const parsed = BodySchema.safeParse({ entryId });
  if (!parsed.success) return validationError(parsed.error);

  const list = await ensureOwnedList(userId, paramsParsed.data.id);
  if (!list) return errorResponse(404, 'not_found', 'List not found');

  await db
    .delete(listEntries)
    .where(
      and(eq(listEntries.listId, list.id), eq(listEntries.entryId, parsed.data.entryId)),
    );
  return NextResponse.json({ data: { listId: list.id, entryId: parsed.data.entryId, removed: true } });
}
