import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { entries, STATUSES } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

const ParamsSchema = z.object({ id: z.string().min(1) });

const PatchSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    userScore: z.number().int().min(1).max(10).nullable().optional(),
    privateNotes: z.string().max(2000).nullable().optional(),
    episodesWatched: z.number().int().min(0).optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const userId = getCurrentUserId();

  const rl = await checkRateLimit(clientKeyFromRequest(req, 'entries-patch'), 120, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many entry edits', undefined, rateLimitHeaders(rl));
  }

  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);

  const body: unknown = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const id = paramsParsed.data.id;
  const existing = await db.query.entries.findFirst({
    where: and(eq(entries.id, id), eq(entries.userId, userId)),
  });
  if (!existing) return errorResponse(404, 'not_found', 'Entry not found');

  const updates: Partial<typeof entries.$inferInsert> = {
    ...parsed.data,
    updatedAt: new Date(),
  };
  if (parsed.data.status === 'completed' && !existing.completedAt) {
    updates.completedAt = new Date();
  }

  await db
    .update(entries)
    .set(updates)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)));

  const updated = await db.query.entries.findFirst({ where: eq(entries.id, id) });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const userId = getCurrentUserId();

  const rl = await checkRateLimit(clientKeyFromRequest(req, 'entries-delete'), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many entry deletes', undefined, rateLimitHeaders(rl));
  }

  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);

  const id = paramsParsed.data.id;
  const existing = await db.query.entries.findFirst({
    where: and(eq(entries.id, id), eq(entries.userId, userId)),
  });
  if (!existing) return errorResponse(404, 'not_found', 'Entry not found');

  await db.delete(entries).where(and(eq(entries.id, id), eq(entries.userId, userId)));
  return NextResponse.json({ data: { id, deleted: true } });
}
