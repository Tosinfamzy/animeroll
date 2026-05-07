import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { lists, listEntries } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

export async function GET() {
  const userId = getCurrentUserId();
  const rows = await db
    .select({
      list: lists,
      entryCount: sql<number>`count(${listEntries.entryId})`.as('entry_count'),
    })
    .from(lists)
    .leftJoin(listEntries, eq(listEntries.listId, lists.id))
    .where(eq(lists.userId, userId))
    .groupBy(lists.id)
    .orderBy(desc(lists.createdAt));
  return NextResponse.json({ data: rows });
}

const PostSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function POST(req: Request) {
  const userId = getCurrentUserId();

  const rl = await checkRateLimit(clientKeyFromRequest(req, 'lists-create'), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many lists created', undefined, rateLimitHeaders(rl));
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const id = crypto.randomUUID();
  await db.insert(lists).values({
    id,
    userId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });
  const created = await db.query.lists.findFirst({ where: eq(lists.id, id) });
  if (!created) return errorResponse(500, 'internal_error', 'Failed to create list');
  return NextResponse.json({ data: { list: created, entryCount: 0 } }, { status: 201 });
}
