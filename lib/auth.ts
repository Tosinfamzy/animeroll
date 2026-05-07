import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/api/errors';

/**
 * Tagged error so route handlers can distinguish "not signed in" from other
 * thrown errors and respond with a uniform 401 envelope.
 */
export class UnauthorizedError extends Error {
  constructor(message = 'Sign in required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Returns the current Clerk user id (`user_2…`) or `null` if no session.
 * Async because Clerk's `auth()` reads request headers.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * Returns the current user id, throws `UnauthorizedError` if no session.
 * Use in route handlers to keep the happy path linear.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

/**
 * Wrap a route handler so `UnauthorizedError` becomes a uniform 401.
 *
 * Usage:
 *   export const GET = withAuth(async (req, ctx, userId) => { … });
 *
 * `proxy.ts`'s `auth.protect()` already gates non-public routes at the edge,
 * but this catches anything that slips through (or `requireUserId` calls
 * inside server components / Server Actions later) and keeps the 401 shape
 * consistent across the API.
 */
export function withAuth<TCtx>(
  handler: (req: Request, ctx: TCtx, userId: string) => Promise<NextResponse>,
): (req: Request, ctx: TCtx) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      const userId = await requireUserId();
      return await handler(req, ctx, userId);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return errorResponse(401, 'unauthenticated', err.message);
      }
      throw err;
    }
  };
}
