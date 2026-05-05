import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkRateLimit } from './rate-limit';

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
