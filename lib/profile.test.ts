import { describe, expect, it } from 'vitest';

import { normalizeHandle, validateHandle } from './profile';

describe('normalizeHandle', () => {
  it('trims and lowercases', () => {
    expect(normalizeHandle('  CoolUser  ')).toBe('cooluser');
  });
});

describe('validateHandle', () => {
  it('accepts a valid handle and returns the normalized form', () => {
    expect(validateHandle('Anime_Fan99')).toEqual({ ok: true, handle: 'anime_fan99' });
  });

  it('rejects too short / too long', () => {
    expect(validateHandle('ab')).toEqual({ ok: false, error: 'too_short' });
    expect(validateHandle('a'.repeat(21))).toEqual({ ok: false, error: 'too_long' });
  });

  it('rejects invalid characters', () => {
    expect(validateHandle('has space')).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateHandle('dots.allowed?')).toEqual({ ok: false, error: 'invalid_chars' });
    expect(validateHandle('dash-no')).toEqual({ ok: false, error: 'invalid_chars' });
  });

  it('rejects reserved handles case-insensitively', () => {
    expect(validateHandle('Admin')).toEqual({ ok: false, error: 'reserved' });
    expect(validateHandle('shares')).toEqual({ ok: false, error: 'reserved' });
    expect(validateHandle('api')).toEqual({ ok: false, error: 'reserved' });
  });
});
