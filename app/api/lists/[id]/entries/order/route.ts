import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { listEntries, lists } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';

const ParamsSchema = z.object({ id: z.string().min(1) });
const BodySchema = z.object({
  orderedEntryIds: z.array(z.string().min(1)).min(1).max(500),
});

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * Persist a new order for entries in a list. Body is the full ordered
 * array of entry ids; server writes position = index for each.
 *
 * Validates that every supplied id is currently a member of the list
 * (and only those). Subset reorders are rejected — the client always
 * sends the full list so we don't have to reason about partial updates.
 */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'list-reorder'), 60, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many reorder calls', undefined, rateLimitHeaders(rl));
  }

  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);

  const body: unknown = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const listId = paramsParsed.data.id;
  const { orderedEntryIds } = parsed.data;

  const list = await db.query.lists.findFirst({
    where: and(eq(lists.id, listId), eq(lists.userId, userId)),
  });
  if (!list) return errorResponse(404, 'not_found', 'List not found');

  const existingRows = await db
    .select({ entryId: listEntries.entryId })
    .from(listEntries)
    .where(eq(listEntries.listId, listId));
  const existingSet = new Set(existingRows.map((r) => r.entryId));
  if (existingSet.size !== orderedEntryIds.length) {
    return errorResponse(
      400,
      'invalid_input',
      `List has ${existingSet.size.toString()} members but received ${orderedEntryIds.length.toString()} ids`,
    );
  }
  for (const id of orderedEntryIds) {
    if (!existingSet.has(id)) {
      return errorResponse(400, 'invalid_input', `Entry not in list: ${id}`);
    }
  }

  // Single CASE-driven UPDATE: faster than per-row UPDATEs and atomic without
  // an explicit transaction. Builds: UPDATE list_entries SET position = CASE
  // entry_id WHEN ? THEN 0 WHEN ? THEN 1 ... END WHERE list_id = ?.
  const cases = sql.join(
    orderedEntryIds.map((id, i) => sql`WHEN ${id} THEN ${i}`),
    sql` `,
  );
  await db
    .update(listEntries)
    .set({ position: sql`CASE ${listEntries.entryId} ${cases} END` })
    .where(eq(listEntries.listId, listId));

  return NextResponse.json(
    { data: { listId, count: orderedEntryIds.length } },
    { headers: rateLimitHeaders(rl) },
  );
}
