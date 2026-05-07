import { NextResponse } from 'next/server';
import { z } from 'zod';

import { searchAnime } from '@/lib/api/jikan';
import { getCachedSearch, setCachedSearch } from '@/lib/api/jikan-cache';
import { errorResponse, validationError } from '@/lib/api/errors';
import { log } from '@/lib/logger';
import { checkRateLimit, clientKeyFromRequest, rateLimitHeaders } from '@/lib/rate-limit';

const QuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(25).default(12),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const rl = await checkRateLimit(clientKeyFromRequest(req, 'jikan-search'), 60, 60_000);
  if (!rl.allowed) {
    return errorResponse(429, 'rate_limited', 'Too many search requests', undefined, rateLimitHeaders(rl));
  }

  const { q, limit } = parsed.data;

  const cached = getCachedSearch(q, limit);
  if (cached) {
    return NextResponse.json({ data: cached, cached: true }, { headers: rateLimitHeaders(rl) });
  }

  try {
    const results = await searchAnime(q, limit);
    setCachedSearch(q, limit, results);
    return NextResponse.json({ data: results, cached: false }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    log.error({ route: 'anime/search', q, err }, 'jikan_unreachable');
    return errorResponse(502, 'upstream_error', 'Anime search service is unreachable');
  }
}
