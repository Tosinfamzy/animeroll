'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { jsonFetch } from '@/lib/api/fetch-json';
import type { NormalizedAnime } from '@/lib/api/jikan';

interface AddResponse {
  data: { entry: { id: string }; anime: { malId: number } };
  existed: boolean;
}

export function AddAnimeDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const search = useQuery<{ data: NormalizedAnime[] }>({
    queryKey: ['anime-search', debounced],
    enabled: debounced.length > 0,
    queryFn: ({ signal }) =>
      jsonFetch<{ data: NormalizedAnime[] }>(
        `/api/anime/search?q=${encodeURIComponent(debounced)}&limit=12`,
        { signal },
      ),
    staleTime: 60 * 60 * 1000,
  });

  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (malId: number) =>
      jsonFetch<AddResponse>('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ malId }),
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['entries'] });
      toast.success(data.existed ? 'Already in your library' : 'Added to library');
    },
    onError: () => toast.error('Failed to add'),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setQuery('');
          setDebounced('');
        }
      }}
    >
      <DialogTrigger render={<Button>Add anime</Button>} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add anime to library</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
          {search.isFetching && (
            <p className="text-sm text-muted-foreground">Searching…</p>
          )}
          {!search.isFetching &&
            debounced.length > 0 &&
            (search.data?.data.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                No matches for &ldquo;{debounced}&rdquo;.
              </p>
            )}
          {search.data?.data.map((a) => (
            <div
              key={a.malId}
              className="flex gap-3 items-center p-2 rounded-md border border-border/50"
            >
              <div className="relative w-12 h-16 bg-muted shrink-0 rounded overflow-hidden">
                {a.imageUrl && (
                  <Image
                    src={a.imageUrl}
                    alt={a.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {a.episodes ? `${a.episodes} ep` : 'unknown ep'}
                  {a.year ? ` · ${a.year}` : ''}
                  {a.meanScore ? ` · ★ ${a.meanScore.toFixed(2)}` : ''}
                  {a.genres.length ? ` · ${a.genres.slice(0, 3).join(', ')}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                disabled={add.isPending}
                onClick={() => add.mutate(a.malId)}
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
