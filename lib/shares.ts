import 'server-only';

import { nanoid } from 'nanoid';
import { z } from 'zod';

import { STATUSES, type AnimeCacheRow, type EntryRow, type ListRow } from './db/schema';

export const SHARE_TOKEN_LENGTH = 10;
export const REACTOR_COOKIE = 'reactor_id';
export const REACTOR_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 90; // 90 days

export function generateShareToken(): string {
  return nanoid(SHARE_TOKEN_LENGTH);
}

export function generateReactorId(): string {
  return crypto.randomUUID();
}

const StatusEnum = z.enum(STATUSES);

export const EntrySnapshotSchema = z.object({
  malId: z.number().int(),
  title: z.string(),
  titleEnglish: z.string().nullable(),
  imageUrl: z.string(),
  episodes: z.number().int().nullable(),
  durationMinutes: z.number().int().nullable(),
  genres: z.array(z.string()),
  year: z.number().int().nullable(),
  synopsis: z.string().nullable(),
  userScore: z.number().int().min(1).max(10).nullable(),
  status: StatusEnum,
});
export type EntrySnapshot = z.infer<typeof EntrySnapshotSchema>;

export const ListEntrySnapshotSchema = z.object({
  malId: z.number().int(),
  title: z.string(),
  imageUrl: z.string(),
  userScore: z.number().int().min(1).max(10).nullable(),
  status: StatusEnum,
});
export const ListSnapshotSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  entries: z.array(ListEntrySnapshotSchema),
});
export type ListSnapshot = z.infer<typeof ListSnapshotSchema>;

export function buildEntrySnapshot(entry: EntryRow, anime: AnimeCacheRow): EntrySnapshot {
  return {
    malId: anime.malId,
    title: anime.title,
    titleEnglish: anime.titleEnglish,
    imageUrl: anime.imageUrl,
    episodes: anime.episodes,
    durationMinutes: anime.durationMinutes,
    genres: parseGenres(anime.genres),
    year: anime.year,
    synopsis: anime.synopsis,
    userScore: entry.userScore,
    status: entry.status,
  };
}

export function buildListSnapshot(
  list: ListRow,
  members: Array<{ entry: EntryRow; anime: AnimeCacheRow }>,
): ListSnapshot {
  return {
    name: list.name,
    description: list.description,
    entries: members.map(({ entry, anime }) => ({
      malId: anime.malId,
      title: anime.title,
      imageUrl: anime.imageUrl,
      userScore: entry.userScore,
      status: entry.status,
    })),
  };
}

export function parseGenres(stored: string): string[] {
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function parseSnapshot(kind: 'entry', raw: string): EntrySnapshot;
export function parseSnapshot(kind: 'list', raw: string): ListSnapshot;
export function parseSnapshot(kind: 'entry' | 'list', raw: string): EntrySnapshot | ListSnapshot {
  const json: unknown = JSON.parse(raw);
  if (kind === 'entry') return EntrySnapshotSchema.parse(json);
  return ListSnapshotSchema.parse(json);
}

export function shareUrl(token: string, kind: 'entry' | 'list'): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  return `${base}/share/${kind}/${token}`;
}
