import 'server-only';

import { z } from 'zod';

const BASE = 'https://api.jikan.moe/v4';
const HEADERS = { Accept: 'application/json', 'User-Agent': 'animeroll/0.1 (+recommend)' };

const RecResponseSchema = z.object({
  data: z.array(z.object({ entry: z.object({ mal_id: z.number() }) })),
});

/**
 * MAL's own "users who liked X also liked…" edges for one title, via Jikan.
 * Returns the recommended MAL ids (best-effort: any upstream/parse failure
 * yields an empty list so one bad seed doesn't sink the whole request).
 */
export async function fetchRecommendedMalIds(seedMalId: number): Promise<number[]> {
  try {
    const res = await fetch(`${BASE}/anime/${seedMalId}/recommendations`, { headers: HEADERS });
    if (!res.ok) return [];
    const json: unknown = await res.json().catch(() => null);
    const parsed = RecResponseSchema.safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.data.map((d) => d.entry.mal_id);
  } catch {
    return [];
  }
}
