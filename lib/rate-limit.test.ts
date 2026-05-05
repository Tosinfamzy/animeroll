import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to limit requests then 429s', () => {
    const key = `test-burst-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills tokens over time at limit/windowMs rate', () => {
    const key = `test-refill-${Math.random()}`;
    // Drain
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);
    // Advance half the window — should regain ~1.5 tokens, enough for one allow.
    vi.advanceTimersByTime(30_000);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
  });

  it('isolates buckets per key', () => {
    expect(checkRateLimit('one', 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit('one', 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit('two', 1, 60_000).allowed).toBe(true);
  });
});
