import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = Boolean(upstashUrl && upstashToken);

const redis = useUpstash
  ? new Redis({ url: upstashUrl as string, token: upstashToken as string })
  : null;

const limiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(prefix: string, limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${prefix}:${limit}/${windowMs}`;
  let rl = limiterCache.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `animeroll:${prefix}`,
      analytics: false,
    });
    limiterCache.set(key, rl);
  }
  return rl;
}

// Process-local fallback bucket. Sufficient for `next dev` (single process).
// On Vercel serverless this is effectively a no-op per-invocation; the
// Upstash path above is the production-correct one.
interface Bucket {
  tokens: number;
  lastRefill: number;
}
const buckets = new Map<string, Bucket>();

function inMemoryCheck(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket: Bucket = existing ?? { tokens: limit, lastRefill: now };
  const elapsed = now - bucket.lastRefill;
  const refillRate = limit / windowMs;
  bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: 0,
    };
  }
  buckets.set(key, bucket);
  const tokensNeeded = 1 - bucket.tokens;
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: Math.ceil(tokensNeeded / refillRate),
  };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const prefix = key.split(':')[0] || 'rl';
  const limiter = getUpstashLimiter(prefix, limit, windowMs);
  if (limiter) {
    const r = await limiter.limit(key);
    return {
      allowed: r.success,
      remaining: r.remaining,
      retryAfterMs: r.success ? 0 : Math.max(0, r.reset - Date.now()),
    };
  }
  return inMemoryCheck(key, limit, windowMs);
}

export function clientKeyFromRequest(req: Request, suffix: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  return `${suffix}:${ip}`;
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  if (result.allowed) {
    return { 'X-RateLimit-Remaining': String(result.remaining) };
  }
  return {
    'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
    'X-RateLimit-Remaining': '0',
  };
}
