import 'server-only';

import { z } from 'zod';

import { upsertAnimeCache } from '@/lib/db/queries';
import { log } from '@/lib/logger';
import { type Status } from '@/lib/db/schema';
import { normalizeAnime, type JikanAnime } from './jikan';

const BASE = 'https://api.jikan.moe/v4';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'animeroll/0.1 (+import)',
};

const ImageSchema = z
  .object({
    jpg: z
      .object({
        large_image_url: z.url().nullable().optional(),
        image_url: z.url().nullable().optional(),
      })
      .optional(),
  })
  .optional();

const AiredSchema = z.object({ from: z.string().nullable().optional() }).optional().nullable();

const EmbeddedAnimeSchema = z.object({
  mal_id: z.number(),
  title: z.string(),
  title_english: z.string().nullable().optional(),
  images: ImageSchema,
  episodes: z.number().nullable().optional(),
  duration: z.string().nullable().optional(),
  aired: AiredSchema,
  genres: z.array(z.object({ name: z.string() })).optional(),
  score: z.number().nullable().optional(),
  synopsis: z.string().nullable().optional(),
}) satisfies z.ZodType<JikanAnime>;

const UserListItemSchema = z.object({
  anime: EmbeddedAnimeSchema,
  watch_status: z.number().int().min(1).max(7),
  score: z.number().int().min(0).max(10),
  episodes_watched: z.number().int().min(0).optional(),
});

const UserListResponseSchema = z.object({
  data: z.array(UserListItemSchema),
  pagination: z.object({
    has_next_page: z.boolean(),
    last_visible_page: z.number(),
    current_page: z.number(),
  }),
});

/**
 * MAL watch_status int → our Status enum.
 *   1 = Currently Watching → 'watching'
 *   2 = Completed          → 'completed'
 *   3 = On Hold            → 'on_hold'
 *   4 = Dropped            → 'dropped'
 *   6 = Plan to Watch      → 'plan'
 *   (5 = ignored, 7 = priority bookmark; both treated as 'plan')
 */
const STATUS_MAP: Record<number, Status> = {
  1: 'watching',
  2: 'completed',
  3: 'on_hold',
  4: 'dropped',
  6: 'plan',
};

export interface ImportedEntry {
  malId: number;
  status: Status;
  score: number | null;
  episodesWatched: number;
}

export type ImportFilter = 'all' | 'watching' | 'completed' | 'plan';

const FILTER_PARAM: Record<ImportFilter, string | null> = {
  all: null,
  watching: 'watching',
  completed: 'completed',
  plan: 'planning',
};

/**
 * Fetch a user's full MAL list via Jikan (paginated) and upsert each
 * anime into our cache. Returns a normalised list of entries ready to
 * be inserted into our `entries` table.
 *
 * Throws on Jikan errors (404 user-not-found, 5xx, schema mismatch).
 */
export async function fetchUserAnimelist(
  username: string,
  filter: ImportFilter,
): Promise<ImportedEntry[]> {
  const filterParam = FILTER_PARAM[filter];
  const items: z.infer<typeof UserListItemSchema>[] = [];
  let page = 1;
  // Hard cap: Jikan returns up to 50 pages = 5000 entries; even mega-list
  // users usually fit in <500. We stop early if the API says no more pages.
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    const url = new URL(`${BASE}/users/${encodeURIComponent(username)}/animelist`);
    url.searchParams.set('page', String(page));
    if (filterParam) url.searchParams.set('status', filterParam);

    const res = await fetch(url, { headers: HEADERS });
    if (res.status === 404) {
      throw new Error('user_not_found');
    }
    if (!res.ok) {
      throw new Error(`jikan_${res.status.toString()}`);
    }
    const json: unknown = await res.json();
    const parsed = UserListResponseSchema.parse(json);
    items.push(...parsed.data);
    if (!parsed.pagination.has_next_page) break;
    page += 1;
  }

  // Upsert anime cache rows in parallel (Drizzle handles individual upserts).
  const cached: ImportedEntry[] = [];
  for (const item of items) {
    const status = STATUS_MAP[item.watch_status];
    if (!status) continue; // skip unknown status codes
    try {
      await upsertAnimeCache(normalizeAnime(item.anime));
    } catch (err) {
      log.warn({ malId: item.anime.mal_id, err }, 'mal_import_cache_upsert_failed');
      continue;
    }
    cached.push({
      malId: item.anime.mal_id,
      status,
      score: item.score > 0 ? item.score : null,
      episodesWatched: item.episodes_watched ?? 0,
    });
  }
  return cached;
}
