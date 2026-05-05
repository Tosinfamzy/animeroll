import 'server-only';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// Process-local bucket. Sufficient for `next dev` (single process).
// On Vercel serverless this is effectively a no-op per-invocation;
// swap for Upstash Redis before opening the URL beyond a trusted circle.
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
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

export function clientKeyFromRequest(req: Request, suffix: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  return `${ip}:${suffix}`;
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
