import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { shares } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';

const ParamsSchema = z.object({ token: z.string().min(1) });

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/**
 * Revoke a share — sets `revoked_at` to now. The share row stays for audit
 * (creator can still see it on /shares) but `loadShareByToken` returns null
 * for revoked tokens, so public /share/<token> URLs 404 immediately.
 */
export async function POST(req: Request, { params }: RouteCtx) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'shares-revoke'), 60, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many revoke calls', undefined, rateLimitHeaders(rl));
  }

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);

  const existing = await db.query.shares.findFirst({
    where: and(eq(shares.token, parsed.data.token), eq(shares.createdBy, userId)),
  });
  if (!existing) return errorResponse(404, 'not_found', 'Share not found');

  if (existing.revokedAt) {
    return NextResponse.json(
      { data: { token: parsed.data.token, revokedAt: existing.revokedAt.toISOString(), already: true } },
      { headers: rateLimitHeaders(rl) },
    );
  }

  const revokedAt = new Date();
  await db
    .update(shares)
    .set({ revokedAt })
    .where(and(eq(shares.token, parsed.data.token), eq(shares.createdBy, userId)));

  return NextResponse.json(
    { data: { token: parsed.data.token, revokedAt: revokedAt.toISOString(), already: false } },
    { headers: rateLimitHeaders(rl) },
  );
}
