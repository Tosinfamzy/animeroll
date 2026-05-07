import 'server-only';

import { z } from 'zod';

const ImagesSchema = z
  .object({
    jpg: z
      .object({
        large_image_url: z.url().nullable().optional(),
        image_url: z.url().nullable().optional(),
      })
      .optional(),
  })
  .optional();

const GenreSchema = z.object({ name: z.string() });

const AiredSchema = z
  .object({
    from: z.string().nullable().optional(),
  })
  .optional()
  .nullable();

const AnimeSchema = z.object({
  mal_id: z.number(),
  title: z.string(),
  title_english: z.string().nullable().optional(),
  images: ImagesSchema,
  episodes: z.number().nullable().optional(),
  duration: z.string().nullable().optional(),
  aired: AiredSchema,
  genres: z.array(GenreSchema).optional(),
  score: z.number().nullable().optional(),
  synopsis: z.string().nullable().optional(),
});

const SearchResponseSchema = z.object({ data: z.array(AnimeSchema) });
const FullResponseSchema = z.object({ data: AnimeSchema });

export type JikanAnime = z.infer<typeof AnimeSchema>;

export interface NormalizedAnime {
  malId: number;
  title: string;
  titleEnglish: string | null;
  imageUrl: string;
  episodes: number | null;
  durationMinutes: number | null;
  genres: string[];
  year: number | null;
  meanScore: number | null;
  synopsis: string | null;
}

const BASE = 'https://api.jikan.moe/v4';

function parseDurationMinutes(d?: string | null): number | null {
  if (!d) return null;
  const minMatch = /(\d+)\s*min/.exec(d);
  if (minMatch) return Number(minMatch[1]);
  const hrMatch = /(\d+)\s*hr/.exec(d);
  if (hrMatch) return Number(hrMatch[1]) * 60;
  return null;
}

function extractYear(aired: JikanAnime['aired']): number | null {
  const from = aired?.from;
  if (!from) return null;
  const y = from.slice(0, 4);
  return /^\d{4}$/.test(y) ? Number(y) : null;
}

export function normalizeAnime(a: JikanAnime): NormalizedAnime {
  const imageUrl = a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? '';
  return {
    malId: a.mal_id,
    title: a.title,
    titleEnglish: a.title_english ?? null,
    imageUrl,
    episodes: a.episodes ?? null,
    durationMinutes: parseDurationMinutes(a.duration),
    genres: (a.genres ?? []).map((g) => g.name),
    year: extractYear(a.aired ?? null),
    meanScore: a.score ?? null,
    synopsis: a.synopsis ?? null,
  };
}

export async function searchAnime(
  query: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<NormalizedAnime[]> {
  const url = new URL(`${BASE}/anime`);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('sfw', 'true');
  url.searchParams.set('order_by', 'popularity');

  const res = await fetch(url, { signal, headers: { Accept: 'application/json', 'User-Agent': 'anime-rolodex/0.1 (+local-dev)' } });
  if (!res.ok) throw new Error(`Jikan search failed: ${res.status}`);
  const json: unknown = await res.json();
  const parsed = SearchResponseSchema.parse(json);
  const seen = new Set<number>();
  const deduped: typeof parsed.data = [];
  for (const a of parsed.data) {
    if (seen.has(a.mal_id)) continue;
    seen.add(a.mal_id);
    deduped.push(a);
  }
  return deduped.map(normalizeAnime);
}

export async function getAnimeById(
  malId: number,
  signal?: AbortSignal,
): Promise<NormalizedAnime> {
  const res = await fetch(`${BASE}/anime/${malId}/full`, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': 'anime-rolodex/0.1 (+local-dev)' },
  });
  if (!res.ok) throw new Error(`Jikan getAnimeById(${malId}) failed: ${res.status}`);
  const json: unknown = await res.json();
  const parsed = FullResponseSchema.parse(json);
  return normalizeAnime(parsed.data);
}
