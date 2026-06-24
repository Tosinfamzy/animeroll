import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { shareViews, shares } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { REACTOR_COOKIE } from '@/lib/shares';

const ParamsSchema = z.object({ token: z.string().min(1) });

interface RouteCtx {
  params: Promise<{ token: string }>;
}

function readReactorId(req: Request): string | undefined {
  const cookie = req.headers.get('cookie') ?? '';
  const m = new RegExp(`(?:^|;\\s*)${REACTOR_COOKIE}=([^;]+)`).exec(cookie);
  return m?.[1];
}

/**
 * Anonymous viewer key. Prefer the stable reactor cookie; otherwise a salted
 * hash of IP+UA. The raw IP is never persisted.
 */
function viewerKey(req: Request): string {
  const reactorId = readReactorId(req);
  if (reactorId) return `r:${reactorId}`;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';
  const digest = createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);
  return `h:${digest}`;
}

/**
 * Record an anonymous open of a public share. Fired as a fire-and-forget beacon
 * from the public view (the share pages are ISR-cached, so server-side
 * recording would undercount). The unique (share_token, viewer_key) index makes
 * a refresh a no-op — row count is the share's unique-viewer total. The share
 * owner's own opens are not recorded.
 */
export async function POST(req: Request, { params }: RouteCtx) {
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);
  const { token } = parsed.data;

  const key = viewerKey(req);
  const rl = await checkRateLimit(clientKeyFromRequest(req, `view:${key}`), 60, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many requests', undefined, rateLimitHeaders(rl));
  }

  const share = await db.query.shares.findFirst({ where: eq(shares.token, token) });
  if (!share || share.revokedAt) {
    // Don't leak existence; a revoked/unknown token simply isn't counted.
    return new NextResponse(null, { status: 204, headers: rateLimitHeaders(rl) });
  }

  // Don't count the creator viewing their own share.
  const userId = await getCurrentUserId();
  if (userId && userId === share.createdBy) {
    return new NextResponse(null, { status: 204, headers: rateLimitHeaders(rl) });
  }

  await db
    .insert(shareViews)
    .values({ id: crypto.randomUUID(), shareToken: token, viewerKey: key })
    .onConflictDoUpdate({
      target: [shareViews.shareToken, shareViews.viewerKey],
      set: { viewedAt: new Date() },
    });

  return new NextResponse(null, { status: 204, headers: rateLimitHeaders(rl) });
}
