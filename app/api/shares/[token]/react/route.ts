import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { reactions, shares, REACTION_KINDS } from '@/lib/db/schema';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import {
  generateReactorId,
  REACTOR_COOKIE,
  REACTOR_COOKIE_MAX_AGE_S,
} from '@/lib/shares';

const ParamsSchema = z.object({ token: z.string().min(1) });
const PutBodySchema = z.object({ kind: z.enum(REACTION_KINDS) });

interface RouteCtx {
  params: Promise<{ token: string }>;
}

function readReactorId(req: Request): string | undefined {
  const cookie = req.headers.get('cookie') ?? '';
  const m = new RegExp(`(?:^|;\\s*)${REACTOR_COOKIE}=([^;]+)`).exec(cookie);
  return m?.[1];
}

function setReactorCookieHeader(reactorId: string): string {
  const parts = [
    `${REACTOR_COOKIE}=${reactorId}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${REACTOR_COOKIE_MAX_AGE_S}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

async function ensureShare(token: string) {
  const row = await db.query.shares.findFirst({ where: eq(shares.token, token) });
  if (!row || row.revokedAt) return null;
  return row;
}

export async function PUT(req: Request, { params }: RouteCtx) {
  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);
  const { token } = paramsParsed.data;

  const body: unknown = await req.json().catch(() => null);
  const parsed = PutBodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  let reactorId = readReactorId(req);
  const isNew = !reactorId;
  reactorId ??= generateReactorId();

  const rl = await checkRateLimit(clientKeyFromRequest(req, `react:${reactorId}`), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many reactions', undefined, rateLimitHeaders(rl));
  }

  const share = await ensureShare(token);
  if (!share) return errorResponse(404, 'not_found', 'Share not found');

  // Upsert: one reaction per (share_token, reactor_id) — switching kind replaces.
  const existing = await db.query.reactions.findFirst({
    where: and(eq(reactions.shareToken, token), eq(reactions.reactorId, reactorId)),
  });
  if (existing) {
    await db
      .update(reactions)
      .set({ kind: parsed.data.kind, updatedAt: new Date() })
      .where(and(eq(reactions.shareToken, token), eq(reactions.reactorId, reactorId)));
  } else {
    await db.insert(reactions).values({
      id: crypto.randomUUID(),
      shareToken: token,
      reactorId,
      kind: parsed.data.kind,
    });
  }

  const headers = new Headers(rateLimitHeaders(rl));
  if (isNew) headers.append('Set-Cookie', setReactorCookieHeader(reactorId));
  return NextResponse.json({ data: { kind: parsed.data.kind } }, { headers });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const paramsParsed = ParamsSchema.safeParse(await params);
  if (!paramsParsed.success) return validationError(paramsParsed.error);
  const { token } = paramsParsed.data;

  const reactorId = readReactorId(req);
  if (!reactorId) {
    return NextResponse.json({ data: { removed: false } });
  }

  const rl = await checkRateLimit(clientKeyFromRequest(req, `react:${reactorId}`), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many reactions', undefined, rateLimitHeaders(rl));
  }

  const share = await ensureShare(token);
  if (!share) return errorResponse(404, 'not_found', 'Share not found');

  await db
    .delete(reactions)
    .where(and(eq(reactions.shareToken, token), eq(reactions.reactorId, reactorId)));
  return NextResponse.json({ data: { removed: true } }, { headers: rateLimitHeaders(rl) });
}
