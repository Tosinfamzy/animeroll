import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkRateLimit, selectStore } from './rate-limit';

describe('selectStore', () => {
  it('chooses redis when UPSTASH_* env is present', () => {
    const choice = selectStore({
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'tok',
    });
    expect(choice).toEqual({
      kind: 'redis',
      url: 'https://example.upstash.io',
      token: 'tok',
    });
  });

  it('accepts Vercel KV_* aliases', () => {
    const choice = selectStore({
      KV_REST_API_URL: 'https://kv.vercel-storage.com',
      KV_REST_API_TOKEN: 'kvtok',
    });
    expect(choice).toEqual({
      kind: 'redis',
      url: 'https://kv.vercel-storage.com',
      token: 'kvtok',
    });
  });

  it('falls back to memory when no credentials are present', () => {
    expect(selectStore({})).toEqual({ kind: 'memory' });
  });

  it('falls back to memory when only one half of the pair is set', () => {
    expect(
      selectStore({ UPSTASH_REDIS_REST_URL: 'https://x' }),
    ).toEqual({ kind: 'memory' });
  });

  it('treats empty-string vars as absent and falls through to KV', () => {
    const choice = selectStore({
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '   ',
      KV_REST_API_URL: 'https://kv.example',
      KV_REST_API_TOKEN: 'kvtok',
    });
    expect(choice).toEqual({ kind: 'redis', url: 'https://kv.example', token: 'kvtok' });
  });

  it('returns memory when every candidate is empty', () => {
    expect(
      selectStore({
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
        KV_REST_API_URL: '',
        KV_REST_API_TOKEN: '',
      }),
    ).toEqual({ kind: 'memory' });
  });
});

describe('checkRateLimit (in-memory fallback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to limit requests then 429s', async () => {
    const key = `test-burst-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(key, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills tokens over time at limit/windowMs rate', async () => {
    const key = `test-refill-${Math.random()}`;
    for (let i = 0; i < 3; i++) await checkRateLimit(key, 3, 60_000);
    expect((await checkRateLimit(key, 3, 60_000)).allowed).toBe(false);
    vi.advanceTimersByTime(30_000);
    expect((await checkRateLimit(key, 3, 60_000)).allowed).toBe(true);
  });

  it('isolates buckets per key', async () => {
    expect((await checkRateLimit('alpha', 1, 60_000)).allowed).toBe(true);
    expect((await checkRateLimit('alpha', 1, 60_000)).allowed).toBe(false);
    expect((await checkRateLimit('beta', 1, 60_000)).allowed).toBe(true);
  });
});
