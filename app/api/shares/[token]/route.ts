import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { shares } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';

const ParamsSchema = z.object({ token: z.string().min(1) });

const PatchSchema = z
  .object({
    take: z.string().trim().max(280).nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' });

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/**
 * Edit a share's take. Same trim + 280-char rules as creation. Empty
 * string after trim becomes null (no take).
 *
 * Owner-only. Reactions and the URL are untouched — this is a metadata
 * edit, not a re-snapshot.
 */
export async function PATCH(req: Request, { params }: RouteCtx) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'shares-edit'), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many edits', undefined, rateLimitHeaders(rl));
  }

  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);

  const body: unknown = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await db.query.shares.findFirst({
    where: and(eq(shares.token, paramsParsed.data.token), eq(shares.createdBy, userId)),
  });
  if (!existing) return errorResponse(404, 'not_found', 'Share not found');

  const trimmed = parsed.data.take?.trim() ?? null;
  const next = trimmed && trimmed.length > 0 ? trimmed : null;

  await db
    .update(shares)
    .set({ take: next })
    .where(and(eq(shares.token, paramsParsed.data.token), eq(shares.createdBy, userId)));

  return NextResponse.json(
    { data: { token: paramsParsed.data.token, take: next } },
    { headers: rateLimitHeaders(rl) },
  );
}
