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
    take: z.string().trim().max(280).nullable().optional(),
    includeScore: z.boolean().optional(),
  })
  .refine((v) => v.take !== undefined || v.includeScore !== undefined, {
    message: 'At least one field required',
  });

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/**
 * Edit a share's take and/or includeScore. Same trim + 280-char rules as
 * creation; empty take after trim becomes null. includeScore is the
 * public-render gate for the snapshot's user_score.
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

  const updates: { take?: string | null; includeScore?: boolean } = {};
  if (parsed.data.take !== undefined) {
    const trimmed = parsed.data.take?.trim() ?? null;
    updates.take = trimmed && trimmed.length > 0 ? trimmed : null;
  }
  if (parsed.data.includeScore !== undefined) {
    updates.includeScore = parsed.data.includeScore;
  }

  await db
    .update(shares)
    .set(updates)
    .where(and(eq(shares.token, paramsParsed.data.token), eq(shares.createdBy, userId)));

  return NextResponse.json(
    {
      data: {
        token: paramsParsed.data.token,
        take: updates.take ?? existing.take,
        includeScore: updates.includeScore ?? existing.includeScore,
      },
    },
    { headers: rateLimitHeaders(rl) },
  );
}
