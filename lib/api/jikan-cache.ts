import 'server-only';

import { LRUCache } from 'lru-cache';

import type { NormalizedAnime } from './jikan';

const HOUR_MS = 60 * 60 * 1000;

const searchCache = new LRUCache<string, NormalizedAnime[]>({
  max: 100,
  ttl: HOUR_MS,
});

function searchKey(query: string, limit: number): string {
  return `${query.toLowerCase().trim()}::${limit}`;
}

export function getCachedSearch(query: string, limit: number): NormalizedAnime[] | undefined {
  return searchCache.get(searchKey(query, limit));
}

export function setCachedSearch(
  query: string,
  limit: number,
  results: NormalizedAnime[],
): void {
  searchCache.set(searchKey(query, limit), results);
}

export function clearSearchCache(): void {
  searchCache.clear();
}
