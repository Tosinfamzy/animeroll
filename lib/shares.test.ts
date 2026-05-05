import { describe, expect, it } from 'vitest';

import type { AnimeCacheRow, EntryRow, ListRow } from './db/schema';
import {
  buildEntrySnapshot,
  buildListSnapshot,
  EntrySnapshotSchema,
  generateReactorId,
  generateShareToken,
  ListSnapshotSchema,
  parseGenres,
  parseSnapshot,
  SHARE_TOKEN_LENGTH,
} from './shares';

const makeAnime = (over: Partial<AnimeCacheRow> = {}): AnimeCacheRow => ({
  malId: 20,
  title: 'Naruto',
  titleEnglish: 'Naruto',
  imageUrl: 'https://example.com/cover.jpg',
  episodes: 220,
  durationMinutes: 23,
  genres: JSON.stringify(['Action', 'Adventure']),
  year: 2002,
  meanScore: 8.0,
  synopsis: 'a synopsis',
  cachedAt: new Date(),
  ...over,
});

const makeEntry = (over: Partial<EntryRow> = {}): EntryRow => ({
  id: 'entry-1',
  userId: 'me',
  malId: 20,
  status: 'watching',
  userScore: 9,
  privateNotes: 'do not share',
  episodesWatched: 200,
  archived: false,
  addedAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  ...over,
});

const makeList = (over: Partial<ListRow> = {}): ListRow => ({
  id: 'list-1',
  userId: 'me',
  name: 'Current rotation',
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe('share tokens', () => {
  it('generateShareToken produces SHARE_TOKEN_LENGTH-char ids', () => {
    const t = generateShareToken();
    expect(t).toHaveLength(SHARE_TOKEN_LENGTH);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('generateShareToken yields distinct values', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateShareToken());
    expect(seen.size).toBe(50);
  });
  it('generateReactorId yields valid UUIDs', () => {
    const id = generateReactorId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('parseGenres', () => {
  it('decodes a JSON-encoded array', () => {
    expect(parseGenres('["Action","Drama"]')).toEqual(['Action', 'Drama']);
  });
  it('returns [] for malformed JSON', () => {
    expect(parseGenres('not json')).toEqual([]);
  });
  it('drops non-string entries defensively', () => {
    expect(parseGenres('["Action",1,null]')).toEqual(['Action']);
  });
});

describe('buildEntrySnapshot', () => {
  it('captures anime metadata + entry score/status, omits private_notes', () => {
    const snap = buildEntrySnapshot(makeEntry(), makeAnime());
    expect(snap.title).toBe('Naruto');
    expect(snap.userScore).toBe(9);
    expect(snap.status).toBe('watching');
    expect(snap.genres).toEqual(['Action', 'Adventure']);
    expect((snap as unknown as Record<string, unknown>).privateNotes).toBeUndefined();
  });

  it('parses through EntrySnapshotSchema', () => {
    const snap = buildEntrySnapshot(makeEntry(), makeAnime());
    expect(() => EntrySnapshotSchema.parse(snap)).not.toThrow();
  });

  it('round-trips through parseSnapshot', () => {
    const snap = buildEntrySnapshot(makeEntry(), makeAnime());
    const json = JSON.stringify(snap);
    const parsed = parseSnapshot('entry', json);
    expect(parsed).toEqual(snap);
  });
});

describe('buildListSnapshot', () => {
  it('captures list + per-member { malId, title, imageUrl, userScore, status }', () => {
    const list = makeList();
    const members = [
      { entry: makeEntry({ id: 'a', malId: 20, userScore: 9 }), anime: makeAnime({ malId: 20 }) },
      {
        entry: makeEntry({ id: 'b', malId: 5114, userScore: 10, status: 'completed' }),
        anime: makeAnime({
          malId: 5114,
          title: 'FMAB',
          imageUrl: 'https://example.com/fmab.jpg',
        }),
      },
    ];
    const snap = buildListSnapshot(list, members);
    expect(snap.name).toBe('Current rotation');
    expect(snap.entries).toHaveLength(2);
    expect(snap.entries[0]).toEqual({
      malId: 20,
      title: 'Naruto',
      imageUrl: 'https://example.com/cover.jpg',
      userScore: 9,
      status: 'watching',
    });
    expect(snap.entries[1].title).toBe('FMAB');
    expect(snap.entries[1].status).toBe('completed');
  });

  it('parses through ListSnapshotSchema', () => {
    const list = makeList();
    const members = [{ entry: makeEntry(), anime: makeAnime() }];
    const snap = buildListSnapshot(list, members);
    expect(() => ListSnapshotSchema.parse(snap)).not.toThrow();
  });

  it('round-trips through parseSnapshot', () => {
    const list = makeList();
    const snap = buildListSnapshot(list, [{ entry: makeEntry(), anime: makeAnime() }]);
    const parsed = parseSnapshot('list', JSON.stringify(snap));
    expect(parsed).toEqual(snap);
  });
});

describe('parseSnapshot', () => {
  it('rejects malformed entry snapshot via Zod', () => {
    expect(() => parseSnapshot('entry', '{"malId":"not-a-number"}')).toThrow();
  });
  it('rejects malformed list snapshot via Zod', () => {
    expect(() => parseSnapshot('list', '{"name":42}')).toThrow();
  });
});
