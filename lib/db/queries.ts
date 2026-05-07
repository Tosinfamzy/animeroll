import 'server-only';

import { eq } from 'drizzle-orm';

import { getAnimeById, type NormalizedAnime } from '../api/jikan';
import { log } from '../logger';
import { db } from './index';
import { animeCache, type AnimeCacheRow } from './schema';

export async function upsertAnimeCache(a: NormalizedAnime): Promise<AnimeCacheRow> {
  const values = {
    malId: a.malId,
    title: a.title,
    titleEnglish: a.titleEnglish,
    imageUrl: a.imageUrl,
    episodes: a.episodes,
    durationMinutes: a.durationMinutes,
    genres: JSON.stringify(a.genres),
    year: a.year,
    meanScore: a.meanScore,
    synopsis: a.synopsis,
    cachedAt: new Date(),
  };
  await db
    .insert(animeCache)
    .values(values)
    .onConflictDoUpdate({ target: animeCache.malId, set: values });
  const fresh = await db.query.animeCache.findFirst({ where: eq(animeCache.malId, a.malId) });
  if (!fresh) throw new Error(`upsertAnimeCache: post-upsert read failed for mal_id=${a.malId}`);
  return fresh;
}

export const ANIME_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isCacheStale(row: { cachedAt: Date }): boolean {
  return Date.now() - row.cachedAt.getTime() > ANIME_CACHE_TTL_MS;
}

/**
 * Returns the cached anime row, fetching from Jikan on miss and upserting.
 * Returns `null` if Jikan is unreachable or the mal_id isn't found upstream.
 *
 * Used by both /api/entries (POST add) and /api/shares/[token]/save so the
 * recipient of a share can save it even if their library doesn't have the
 * anime cached yet.
 */
export async function ensureAnimeCached(malId: number): Promise<AnimeCacheRow | null> {
  const cached = await db.query.animeCache.findFirst({ where: eq(animeCache.malId, malId) });
  if (cached) return cached;
  try {
    const fresh = await getAnimeById(malId);
    return await upsertAnimeCache(fresh);
  } catch (err) {
    log.error({ malId, err }, 'jikan_fetch_failed');
    return null;
  }
}
