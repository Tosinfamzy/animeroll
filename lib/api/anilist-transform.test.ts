import { describe, expect, it } from 'vitest';

import {
  aniListEntryToImported,
  aniListScoreToUserScore,
  mapAniListStatus,
  normalizeAniListMedia,
} from './anilist-transform';

describe('mapAniListStatus', () => {
  it('maps known statuses', () => {
    expect(mapAniListStatus('CURRENT')).toBe('watching');
    expect(mapAniListStatus('REPEATING')).toBe('watching');
    expect(mapAniListStatus('PLANNING')).toBe('plan');
    expect(mapAniListStatus('COMPLETED')).toBe('completed');
    expect(mapAniListStatus('DROPPED')).toBe('dropped');
    expect(mapAniListStatus('PAUSED')).toBe('on_hold');
  });

  it('returns null for unknown statuses', () => {
    expect(mapAniListStatus('NONSENSE')).toBeNull();
  });
});

describe('aniListScoreToUserScore', () => {
  it('treats 0 / negative as unscored', () => {
    expect(aniListScoreToUserScore(0)).toBeNull();
    expect(aniListScoreToUserScore(-3)).toBeNull();
  });

  it('rounds and clamps to 1–10', () => {
    expect(aniListScoreToUserScore(7)).toBe(7);
    expect(aniListScoreToUserScore(8.4)).toBe(8);
    expect(aniListScoreToUserScore(8.6)).toBe(9);
    expect(aniListScoreToUserScore(11)).toBe(10);
  });
});

describe('normalizeAniListMedia', () => {
  it('maps fields and rescales the community score 0–100 → 0–10', () => {
    const n = normalizeAniListMedia(
      {
        idMal: 5,
        title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop' },
        coverImage: { large: 'https://img/large.jpg', medium: 'https://img/med.jpg' },
        episodes: 26,
        duration: 24,
        genres: ['Action', 'Sci-Fi'],
        seasonYear: 1998,
        averageScore: 86,
        description: 'Space <i>bounty</i> hunters.<br>A classic.',
      },
      5,
    );
    expect(n).toEqual({
      malId: 5,
      title: 'Cowboy Bebop',
      titleEnglish: 'Cowboy Bebop',
      imageUrl: 'https://img/large.jpg',
      episodes: 26,
      durationMinutes: 24,
      genres: ['Action', 'Sci-Fi'],
      year: 1998,
      meanScore: 8.6,
      synopsis: 'Space bounty hunters.\nA classic.',
    });
  });

  it('falls back across title and image fields and tolerates missing data', () => {
    const n = normalizeAniListMedia(
      { idMal: 9, title: { romaji: null, english: 'Only English' }, genres: [] },
      9,
    );
    expect(n.title).toBe('Only English');
    expect(n.titleEnglish).toBe('Only English');
    expect(n.imageUrl).toBe('');
    expect(n.episodes).toBeNull();
    expect(n.meanScore).toBeNull();
    expect(n.synopsis).toBeNull();
  });
});

describe('aniListEntryToImported', () => {
  const media = (idMal: number | null) => ({
    idMal,
    title: { romaji: 'X', english: null },
    genres: [],
  });

  it('drops entries with no MAL id', () => {
    expect(
      aniListEntryToImported({ status: 'COMPLETED', score: 9, progress: 12, media: media(null) }),
    ).toBeNull();
  });

  it('drops entries with an unknown status', () => {
    expect(
      aniListEntryToImported({ status: 'WAT', score: 9, progress: 12, media: media(1) }),
    ).toBeNull();
  });

  it('maps a complete entry', () => {
    expect(
      aniListEntryToImported({ status: 'CURRENT', score: 8, progress: 5, media: media(42) }),
    ).toEqual({ malId: 42, status: 'watching', score: 8, episodesWatched: 5 });
  });

  it('defaults progress to 0 and unscored to null', () => {
    expect(
      aniListEntryToImported({ status: 'PLANNING', score: 0, progress: null, media: media(7) }),
    ).toEqual({ malId: 7, status: 'plan', score: null, episodesWatched: 0 });
  });
});
