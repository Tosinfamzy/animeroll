import type { Status } from './db/schema';

export const LENGTH_BUCKETS = ['short', 'medium', 'long'] as const;
export type LengthBucket = (typeof LENGTH_BUCKETS)[number];

export const LENGTH_BUCKET_LABELS: Record<LengthBucket, string> = {
  short: '< 13 episodes',
  medium: '13–26 episodes',
  long: '27+ episodes',
};

export interface FilterableEntry {
  status: Status;
  userScore: number | null;
  archived: boolean;
  anime: {
    title: string;
    titleEnglish: string | null;
    episodes: number | null;
    genres: string[];
    year: number | null;
  };
}

export interface EntryFilter {
  query?: string;
  status?: Status[];
  lengthBuckets?: LengthBucket[];
  genres?: string[];
  yearMin?: number;
  yearMax?: number;
  minScore?: number;
}

export function lengthBucketOf(episodes: number | null): LengthBucket | null {
  if (episodes === null) return null;
  if (episodes < 13) return 'short';
  if (episodes <= 26) return 'medium';
  return 'long';
}

export function entryMatchesFilter(e: FilterableEntry, f: EntryFilter): boolean {
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    if (q.length > 0) {
      const t1 = e.anime.title.toLowerCase();
      const t2 = e.anime.titleEnglish?.toLowerCase() ?? '';
      if (!t1.includes(q) && !t2.includes(q)) return false;
    }
  }
  if (f.status?.length && !f.status.includes(e.status)) return false;
  if (f.lengthBuckets?.length) {
    const b = lengthBucketOf(e.anime.episodes);
    if (!b || !f.lengthBuckets.includes(b)) return false;
  }
  if (f.genres?.length) {
    const hasAny = f.genres.some((g) => e.anime.genres.includes(g));
    if (!hasAny) return false;
  }
  if (f.yearMin !== undefined) {
    if (e.anime.year === null || e.anime.year < f.yearMin) return false;
  }
  if (f.yearMax !== undefined) {
    if (e.anime.year === null || e.anime.year > f.yearMax) return false;
  }
  if (f.minScore !== undefined) {
    if (e.userScore === null || e.userScore < f.minScore) return false;
  }
  return true;
}

export function filterEntries<T extends FilterableEntry>(entries: T[], f: EntryFilter): T[] {
  return entries.filter((e) => entryMatchesFilter(e, f));
}

export function isFilterEmpty(f: EntryFilter): boolean {
  return (
    !f.query?.trim() &&
    !f.status?.length &&
    !f.lengthBuckets?.length &&
    !f.genres?.length &&
    f.yearMin === undefined &&
    f.yearMax === undefined &&
    f.minScore === undefined
  );
}
