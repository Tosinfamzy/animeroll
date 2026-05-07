import { describe, expect, it } from 'vitest';

import {
  entryMatchesFilter,
  filterEntries,
  isFilterEmpty,
  lengthBucketOf,
  type FilterableEntry,
} from './filters';

interface MakeOverrides {
  status?: FilterableEntry['status'];
  userScore?: FilterableEntry['userScore'];
  archived?: FilterableEntry['archived'];
  genres?: string[];
  anime?: Partial<FilterableEntry['anime']>;
}

const make = (overrides: MakeOverrides = {}): FilterableEntry => ({
  status: overrides.status ?? 'plan',
  userScore: overrides.userScore ?? null,
  archived: overrides.archived ?? false,
  anime: {
    title: 'Test Title',
    titleEnglish: null,
    episodes: 12,
    genres: overrides.genres ?? ['Action'],
    year: 2020,
    ...overrides.anime,
  },
});

describe('lengthBucketOf', () => {
  it('returns null for unknown episode count', () => {
    expect(lengthBucketOf(null)).toBe(null);
  });
  it('classifies <13 as short', () => {
    expect(lengthBucketOf(12)).toBe('short');
    expect(lengthBucketOf(1)).toBe('short');
  });
  it('classifies 13–26 as medium', () => {
    expect(lengthBucketOf(13)).toBe('medium');
    expect(lengthBucketOf(24)).toBe('medium');
    expect(lengthBucketOf(26)).toBe('medium');
  });
  it('classifies 27+ as long', () => {
    expect(lengthBucketOf(27)).toBe('long');
    expect(lengthBucketOf(220)).toBe('long');
  });
});

describe('isFilterEmpty', () => {
  it('returns true for {} and undefined values', () => {
    expect(isFilterEmpty({})).toBe(true);
    expect(isFilterEmpty({ status: [] })).toBe(true);
    expect(isFilterEmpty({ genres: [], yearMin: undefined })).toBe(true);
  });
  it('returns false when any filter is set', () => {
    expect(isFilterEmpty({ status: ['plan'] })).toBe(false);
    expect(isFilterEmpty({ minScore: 8 })).toBe(false);
    expect(isFilterEmpty({ yearMax: 2024 })).toBe(false);
  });
});

describe('entryMatchesFilter', () => {
  it('passes empty filter for any entry', () => {
    expect(entryMatchesFilter(make(), {})).toBe(true);
  });

  it('matches query against title (case-insensitive)', () => {
    const entry = make({ anime: { title: 'Sousou no Frieren', titleEnglish: null, episodes: 28, genres: [], year: 2023 } });
    expect(entryMatchesFilter(entry, { query: 'frieren' })).toBe(true);
    expect(entryMatchesFilter(entry, { query: 'FRIE' })).toBe(true);
    expect(entryMatchesFilter(entry, { query: 'naruto' })).toBe(false);
  });

  it('matches query against titleEnglish too', () => {
    const entry = make({
      anime: { title: 'Kimetsu no Yaiba', titleEnglish: 'Demon Slayer', episodes: 26, genres: [], year: 2019 },
    });
    expect(entryMatchesFilter(entry, { query: 'demon' })).toBe(true);
  });

  it('empty/whitespace query is a no-op', () => {
    expect(entryMatchesFilter(make(), { query: '   ' })).toBe(true);
    expect(entryMatchesFilter(make(), { query: '' })).toBe(true);
  });

  it('combines filters with AND', () => {
    const entry = make({
      status: 'watching',
      userScore: 8,
      anime: { episodes: 24, genres: ['Action', 'Drama'], year: 2020 },
    });
    expect(
      entryMatchesFilter(entry, {
        status: ['watching'],
        lengthBuckets: ['medium'],
        genres: ['Action'],
        yearMin: 2019,
        yearMax: 2021,
        minScore: 7,
      }),
    ).toBe(true);
    // Mismatch on minScore breaks the AND.
    expect(
      entryMatchesFilter(entry, {
        status: ['watching'],
        minScore: 9,
      }),
    ).toBe(false);
  });

  it('rejects when length bucket is unset and required', () => {
    const entry = make({ anime: { episodes: null, genres: [], year: null } });
    expect(entryMatchesFilter(entry, { lengthBuckets: ['short'] })).toBe(false);
  });

  it('genre filter is OR (any match)', () => {
    const entry = make({ anime: { episodes: 12, genres: ['Romance'], year: 2020 } });
    expect(entryMatchesFilter(entry, { genres: ['Action', 'Romance'] })).toBe(true);
    expect(entryMatchesFilter(entry, { genres: ['Action'] })).toBe(false);
  });

  it('rejects null userScore against minScore', () => {
    const entry = make({ userScore: null });
    expect(entryMatchesFilter(entry, { minScore: 5 })).toBe(false);
  });
});

describe('filterEntries', () => {
  it('returns matching subset', () => {
    const a = make({ status: 'plan', anime: { episodes: 12, genres: ['Action'], year: 2020 } });
    const b = make({ status: 'completed', anime: { episodes: 220, genres: ['Sports'], year: 2002 } });
    const c = make({ status: 'plan', anime: { episodes: 24, genres: ['Drama'], year: 2024 } });
    expect(filterEntries([a, b, c], { status: ['plan'] })).toEqual([a, c]);
    expect(filterEntries([a, b, c], { lengthBuckets: ['long'] })).toEqual([b]);
  });
});
