import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, rateLimitHeaders, userKeyFromRequest } from '@/lib/rate-limit';
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  HANDLE_ERROR_MESSAGES,
  validateHandle,
} from '@/lib/profile';

const PutSchema = z.object({
  handle: z.string().min(1),
  displayName: z.string().max(DISPLAY_NAME_MAX).nullable().optional(),
  bio: z.string().max(BIO_MAX).nullable().optional(),
  isPublic: z.boolean(),
});

function clean(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t && t.length > 0 ? t : null;
}

export async function GET() {
  const userId = await requireUserId();
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  return NextResponse.json({ data: profile ?? null });
}

/** Create or update the caller's profile (one per user, keyed on userId). */
export async function PUT(req: Request) {
  const userId = await requireUserId();

  const rl = await checkRateLimit(userKeyFromRequest(userId, 'profile-write'), 30, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many updates', undefined, rateLimitHeaders(rl));
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const handleResult = validateHandle(parsed.data.handle);
  if (!handleResult.ok) {
    return errorResponse(422, 'invalid_handle', HANDLE_ERROR_MESSAGES[handleResult.error]);
  }
  const handle = handleResult.handle;

  // Handle must be unique across other users.
  const taken = await db.query.profiles.findFirst({
    where: and(eq(profiles.handle, handle), ne(profiles.userId, userId)),
  });
  if (taken) {
    return errorResponse(409, 'handle_taken', 'That handle is already in use.');
  }

  const now = new Date();
  const values = {
    userId,
    handle,
    displayName: clean(parsed.data.displayName),
    bio: clean(parsed.data.bio),
    isPublic: parsed.data.isPublic,
    updatedAt: now,
  };
  await db
    .insert(profiles)
    .values(values)
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        handle: values.handle,
        displayName: values.displayName,
        bio: values.bio,
        isPublic: values.isPublic,
        updatedAt: now,
      },
    });

  const saved = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  return NextResponse.json({ data: saved }, { headers: rateLimitHeaders(rl) });
}
