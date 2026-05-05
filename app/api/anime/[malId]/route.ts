import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { animeCache } from '@/lib/db/schema';
import { upsertAnimeCache } from '@/lib/db/queries';
import { getAnimeById } from '@/lib/api/jikan';
import { errorResponse, validationError } from '@/lib/api/errors';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';
import { parseGenres } from '@/lib/shares';

const ParamsSchema = z.object({ malId: z.coerce.number().int().positive() });

interface RouteCtx {
  params: Promise<{ malId: string }>;
}

export async function GET(_req: Request, { params }: RouteCtx) {
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);
  const row = await db.query.animeCache.findFirst({
    where: eq(animeCache.malId, parsed.data.malId),
  });
  if (!row) return errorResponse(404, 'not_found', 'Anime not in cache');
  return NextResponse.json({ data: { ...row, genres: parseGenres(row.genres) } });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return validationError(parsed.error);

  const rl = await checkRateLimit(clientKeyFromRequest(req, 'jikan-fetch'), 60, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many refresh requests', undefined, rateLimitHeaders(rl));
  }

  try {
    const fresh = await getAnimeById(parsed.data.malId);
    const row = await upsertAnimeCache(fresh);
    return NextResponse.json(
      { data: { ...row, genres: parseGenres(row.genres) } },
      { headers: rateLimitHeaders(rl) },
    );
  } catch {
    return errorResponse(502, 'upstream_error', 'Could not refresh from Jikan');
  }
}
