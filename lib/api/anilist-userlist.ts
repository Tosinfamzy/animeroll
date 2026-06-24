import 'server-only';

import { z } from 'zod';

import { upsertAnimeCache } from '@/lib/db/queries';
import { log } from '@/lib/logger';
import type { ImportedEntry, ImportFilter } from './jikan-userlist';
import {
  AniListEntrySchema,
  FILTER_STATUS,
  aniListEntryToImported,
  normalizeAniListMedia,
} from './anilist-transform';

const ENDPOINT = 'https://graphql.anilist.co';

// MediaListCollection returns the whole list in one response (no pagination),
// and `score(format: POINT_10)` normalizes any user's score format to a 0–10
// scale server-side — so we don't have to know their scoreFormat.
const QUERY = `
query ($userName: String!, $status: MediaListStatus) {
  MediaListCollection(userName: $userName, type: ANIME, status: $status) {
    lists {
      entries {
        status
        score(format: POINT_10)
        progress
        media {
          idMal
          title { romaji english }
          coverImage { large medium }
          episodes
          duration
          genres
          seasonYear
          averageScore
          description
        }
      }
    }
  }
}`;

const ResponseSchema = z.object({
  data: z
    .object({
      MediaListCollection: z
        .object({ lists: z.array(z.object({ entries: z.array(AniListEntrySchema) })).nullable() })
        .nullable(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(z.object({ status: z.number().optional(), message: z.string().optional() }))
    .optional(),
});

/**
 * Fetch a user's AniList anime list (single GraphQL request) and upsert each
 * title into our cache, keyed on the AniList-provided MAL id. Entries lacking a
 * MAL id are dropped (logged). Throws 'user_not_found' for an unknown user and
 * 'anilist_<status>' for other upstream failures — mirrors the MAL importer.
 */
export async function fetchAniListAnimelist(
  username: string,
  filter: ImportFilter,
): Promise<ImportedEntry[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: { userName: username, status: FILTER_STATUS[filter] },
    }),
  });

  if (res.status === 404) throw new Error('user_not_found');

  const json: unknown = await res.json().catch(() => null);
  if (json === null) throw new Error(`anilist_${res.status.toString()}`);

  const parsed = ResponseSchema.parse(json);
  if (parsed.errors && parsed.errors.length > 0) {
    const notFound = parsed.errors.some(
      (e) => e.status === 404 || /not found/i.test(e.message ?? ''),
    );
    if (notFound) throw new Error('user_not_found');
    throw new Error(`anilist_${(parsed.errors[0]?.status ?? res.status).toString()}`);
  }
  if (!res.ok) throw new Error(`anilist_${res.status.toString()}`);

  const lists = parsed.data?.MediaListCollection?.lists ?? [];
  // A user can have the same title across custom lists; dedupe on malId so we
  // upsert/insert each anime once.
  const seen = new Set<number>();
  const imported: ImportedEntry[] = [];
  let droppedNoMal = 0;

  for (const list of lists) {
    for (const entry of list.entries) {
      const mapped = aniListEntryToImported(entry);
      if (!mapped) {
        if (entry.media.idMal == null) droppedNoMal += 1;
        continue;
      }
      if (seen.has(mapped.malId)) continue;
      seen.add(mapped.malId);
      try {
        await upsertAnimeCache(normalizeAniListMedia(entry.media, mapped.malId));
      } catch (err) {
        log.warn({ malId: mapped.malId, err }, 'anilist_import_cache_upsert_failed');
        continue;
      }
      imported.push(mapped);
    }
  }

  if (droppedNoMal > 0) {
    log.info({ username, droppedNoMal }, 'anilist_import_dropped_no_mal_id');
  }
  return imported;
}
