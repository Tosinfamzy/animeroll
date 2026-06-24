import { z } from 'zod';

import { type Status } from '@/lib/db/schema';
import type { NormalizedAnime } from './jikan';
import type { ImportedEntry, ImportFilter } from './jikan-userlist';

// Pure AniList GraphQL → app transforms. Kept free of DB imports so the unit
// tests can load this module without a configured database. The fetcher in
// anilist-userlist.ts composes these with the cache upsert.

export const AniListMediaSchema = z.object({
  idMal: z.number().nullable(),
  title: z.object({
    romaji: z.string().nullable().optional(),
    english: z.string().nullable().optional(),
  }),
  coverImage: z
    .object({
      large: z.string().nullable().optional(),
      medium: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  episodes: z.number().nullable().optional(),
  duration: z.number().nullable().optional(),
  genres: z.array(z.string()).optional(),
  seasonYear: z.number().nullable().optional(),
  averageScore: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const AniListEntrySchema = z.object({
  status: z.string(),
  score: z.number(),
  progress: z.number().nullable().optional(),
  media: AniListMediaSchema,
});

export type AniListMedia = z.infer<typeof AniListMediaSchema>;
export type AniListEntry = z.infer<typeof AniListEntrySchema>;

/**
 * AniList MediaListStatus → our Status enum.
 *   CURRENT / REPEATING → watching
 *   PLANNING            → plan
 *   COMPLETED           → completed
 *   DROPPED             → dropped
 *   PAUSED              → on_hold
 */
const STATUS_MAP: Record<string, Status> = {
  CURRENT: 'watching',
  REPEATING: 'watching',
  PLANNING: 'plan',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  PAUSED: 'on_hold',
};

export const FILTER_STATUS: Record<ImportFilter, string | undefined> = {
  all: undefined,
  watching: 'CURRENT',
  completed: 'COMPLETED',
  plan: 'PLANNING',
};

export function mapAniListStatus(status: string): Status | null {
  return STATUS_MAP[status] ?? null;
}

/** POINT_10 score → our 1–10 integer, or null for unscored (0). */
export function aniListScoreToUserScore(score: number): number | null {
  if (score <= 0) return null;
  return Math.min(10, Math.max(1, Math.round(score)));
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const text = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 0 ? text : null;
}

/** Map an AniList media object to our cache shape. Caller guarantees a malId. */
export function normalizeAniListMedia(media: AniListMedia, malId: number): NormalizedAnime {
  return {
    malId,
    title: media.title.romaji ?? media.title.english ?? 'Untitled',
    titleEnglish: media.title.english ?? null,
    imageUrl: media.coverImage?.large ?? media.coverImage?.medium ?? '',
    episodes: media.episodes ?? null,
    durationMinutes: media.duration ?? null,
    genres: media.genres ?? [],
    year: media.seasonYear ?? null,
    // AniList averageScore is 0–100; our cache stores a 0–10 community mean.
    meanScore: media.averageScore != null ? media.averageScore / 10 : null,
    synopsis: stripHtml(media.description),
  };
}

/**
 * Pure transform of a parsed AniList entry to an ImportedEntry. Returns null
 * for entries AniList can't map to a MAL id (we key the whole app on malId) or
 * with an unrecognized status.
 */
export function aniListEntryToImported(entry: AniListEntry): ImportedEntry | null {
  const malId = entry.media.idMal;
  if (malId == null) return null;
  const status = mapAniListStatus(entry.status);
  if (!status) return null;
  return {
    malId,
    status,
    score: aniListScoreToUserScore(entry.score),
    episodesWatched: entry.progress ?? 0,
  };
}
