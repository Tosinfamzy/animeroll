import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { reactions, shares } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';
import { tallyReactionKinds } from '@/lib/reactions';

const ParamsSchema = z.object({ token: z.string().min(1) });

const RECENT_LIMIT = 50;

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/**
 * Owner-only reaction drill-down for one share: aggregate counts plus the most
 * recent reaction events (kind + timestamp). Reactors are anonymous by design,
 * so we deliberately expose *no* identity — not even the hashed reactorId — only
 * the kind and when it happened. A non-owner (or unknown) token returns 404 to
 * avoid leaking which tokens exist.
 */
export async function GET(req: Request, { params }: RouteCtx) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'shares-reactions'), 120, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many requests', undefined, rateLimitHeaders(rl));
  }

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);
  const token = parsed.data.token;

  const share = await db.query.shares.findFirst({
    where: and(eq(shares.token, token), eq(shares.createdBy, userId)),
  });
  if (!share) return errorResponse(404, 'not_found', 'Share not found');

  const rows = await db
    .select({ kind: reactions.kind, createdAt: reactions.createdAt })
    .from(reactions)
    .where(eq(reactions.shareToken, token))
    .orderBy(desc(reactions.createdAt))
    .limit(RECENT_LIMIT);

  const counts = tallyReactionKinds(rows.map((r) => r.kind));
  const recent = rows.map((r) => ({ kind: r.kind, at: r.createdAt.toISOString() }));

  return NextResponse.json(
    { data: { token, counts, recent, truncated: rows.length === RECENT_LIMIT } },
    { headers: rateLimitHeaders(rl) },
  );
}
