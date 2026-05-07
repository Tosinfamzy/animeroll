'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { jsonFetch } from '@/lib/api/fetch-json';
import { entryMatchesFilter, type EntryFilter } from '@/lib/filters';
import type { EntryWithAnime } from '@/lib/types';
import { AnimeCard } from './AnimeCard';
import { FilterSidebar } from './FilterSidebar';

interface Props {
  archived?: boolean;
}

export function LibraryView({ archived = false }: Props) {
  const [filter, setFilter] = useState<EntryFilter>({});

  const q = useQuery<{ data: EntryWithAnime[] }>({
    queryKey: ['entries'],
    queryFn: () => jsonFetch<{ data: EntryWithAnime[] }>('/api/entries'),
  });

  const all = q.data?.data ?? [];
  const inScope = all.filter((e) => e.entry.archived === archived);

  const visibleEntries = useMemo(() => {
    return inScope.filter((e) =>
      entryMatchesFilter(
        {
          status: e.entry.status,
          userScore: e.entry.userScore,
          archived: e.entry.archived,
          anime: {
            episodes: e.anime.episodes,
            genres: e.anime.genres,
            year: e.anime.year,
          },
        },
        filter,
      ),
    );
  }, [inScope, filter]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    for (const e of inScope) for (const g of e.anime.genres) set.add(g);
    return [...set].sort();
  }, [inScope]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {q.isLoading
            ? 'Loading…'
            : inScope.length === 0
              ? '0 entries'
              : `${visibleEntries.length} of ${inScope.length}`}
        </p>
        <FilterSidebar filter={filter} onChange={setFilter} availableGenres={availableGenres} />
      </div>

      {q.isLoading ? null : q.isError ? (
        <p className="text-sm text-destructive">Failed to load library.</p>
      ) : inScope.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {archived ? (
            <p>Nothing archived yet.</p>
          ) : (
            <p>Your library is empty. Add an anime to get started.</p>
          )}
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No entries match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {visibleEntries.map((e) => (
            <AnimeCard key={e.entry.id} {...e} />
          ))}
        </div>
      )}
    </div>
  );
}
