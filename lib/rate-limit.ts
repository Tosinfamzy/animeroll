import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

import { log } from './logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Pure, testable resolution of which backing store the limiter should use.
 *
 * Vercel's "Upstash for Redis" marketplace integration injects KV_* names;
 * a direct Upstash setup uses UPSTASH_REDIS_REST_*. Accept either. Exported so
 * a unit test can prove Redis is chosen when env is present and memory
 * otherwise — without constructing a real client.
 */
export type StoreChoice =
  | { kind: 'redis'; url: string; token: string }
  | { kind: 'memory' };

function firstNonEmpty(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    if (v !== undefined && v.trim() !== '') return v;
  }
  return undefined;
}

export function selectStore(env: Record<string, string | undefined>): StoreChoice {
  // Treat empty-string vars as absent: an empty UPSTASH_* must not shadow a
  // valid KV_* (and vice versa). Vercel/the CLI can leave a var defined-but-blank.
  const url = firstNonEmpty(env.UPSTASH_REDIS_REST_URL, env.KV_REST_API_URL);
  const token = firstNonEmpty(env.UPSTASH_REDIS_REST_TOKEN, env.KV_REST_API_TOKEN);
  if (url && token) return { kind: 'redis', url, token };
  return { kind: 'memory' };
}

const store = selectStore(process.env);

// Fail loud on a misconfigured production deploy. The in-memory fallback is a
// per-invocation no-op on serverless, so silently using it in prod means every
// limiter is effectively disabled with zero signal. Set
// RATE_LIMIT_REQUIRE_REDIS=1 to hard-fail module init (and thus the deploy's
// health check) instead of merely logging.
if (process.env.NODE_ENV === 'production' && store.kind === 'memory') {
  const msg =
    'rate-limit: no Upstash/KV credentials in production — limiters are running ' +
    'on the per-invocation in-memory fallback and are effectively DISABLED. ' +
    'Provision Upstash Redis (or Vercel KV) and set UPSTASH_REDIS_REST_URL/_TOKEN.';
  if (process.env.RATE_LIMIT_REQUIRE_REDIS === '1') {
    throw new Error(msg);
  }
  log.error({ store: 'memory' }, msg);
}

const redis: Redis | null =
  store.kind === 'redis' ? new Redis({ url: store.url, token: store.token }) : null;

// Emit one structured warning the first time the in-memory path actually serves
// a request, so an unexpected fallback in any deployed environment is visible.
let fallbackWarned = false;
// Same, but for the case where a configured Upstash limiter throws (outage,
// dead/rotated credentials, network blip). We fail open to the in-memory check
// rather than letting the rejection 500 the request.
let redisErrorWarned = false;

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
  const prefix = key.split(':')[0] ?? 'rl';
  const limiter = getUpstashLimiter(prefix, limit, windowMs);
  if (limiter) {
    try {
      const r = await limiter.limit(key);
      return {
        allowed: r.success,
        remaining: r.remaining,
        retryAfterMs: r.success ? 0 : Math.max(0, r.reset - Date.now()),
      };
    } catch (err) {
      // Fail open to the in-memory check: a Redis outage or bad credentials
      // must not take down every rate-limited endpoint.
      if (!redisErrorWarned) {
        redisErrorWarned = true;
        log.error({ err }, 'rate-limit: Upstash limiter failed; falling back to in-memory');
      }
      return inMemoryCheck(key, limit, windowMs);
    }
  }
  if (!fallbackWarned) {
    fallbackWarned = true;
    log.warn({ store: 'memory' }, 'rate-limit: serving from in-memory fallback');
  }
  return inMemoryCheck(key, limit, windowMs);
}

export function clientKeyFromRequest(req: Request, suffix: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  return `${suffix}:${ip}`;
}

/**
 * Per-user rate-limit key. Use for authed mutation routes so:
 *   - users behind a shared NAT don't share a bucket
 *   - one user roaming to a new IP doesn't get a fresh budget
 *
 * Pair with `await requireUserId()` at the top of the handler.
 */
export function userKeyFromRequest(userId: string, suffix: string): string {
  return `${suffix}:u:${userId}`;
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
