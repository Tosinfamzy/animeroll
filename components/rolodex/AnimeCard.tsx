'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { jsonFetch } from '@/lib/api/fetch-json';
import { STATUSES, type Status } from '@/lib/db/schema';
import type { EntryWithAnime } from '@/lib/types';
import { EntryDetailDialog } from './EntryDetailDialog';
import { STATUS_LABELS, StatusBadge } from './StatusBadge';

interface AnimeCardProps extends EntryWithAnime {
  /**
   * If set, the card renders a "Remove" button that detaches this entry
   * from the given list (without deleting the entry itself). Used by the
   * /lists/[id] view so users can curate without round-tripping through
   * the entry detail dialog.
   */
  removeFromListId?: string;
}

export function AnimeCard({ entry, anime, listIds, removeFromListId }: AnimeCardProps) {
  const qc = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);

  const updateStatus = useMutation({
    mutationFn: (status: Status) =>
      jsonFetch<{ data: unknown }>(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ['entries'] });
      const prev = qc.getQueryData<{ data: EntryWithAnime[] }>(['entries']);
      if (prev) {
        qc.setQueryData<{ data: EntryWithAnime[] }>(['entries'], {
          data: prev.data.map((e) =>
            e.entry.id === entry.id ? { ...e, entry: { ...e.entry, status } } : e,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['entries'], ctx.prev);
      toast.error('Failed to update status');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const archive = useMutation({
    mutationFn: () =>
      jsonFetch<{ data: unknown }>(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !entry.archived }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['entries'] });
      toast.success(entry.archived ? 'Unarchived' : 'Archived');
    },
    onError: () => toast.error('Failed to archive'),
  });

  const removeFromList = useMutation({
    mutationFn: () => {
      if (!removeFromListId) throw new Error('removeFromListId not set');
      return jsonFetch<{ data: unknown }>(
        `/api/lists/${removeFromListId}/entries?entryId=${encodeURIComponent(entry.id)}`,
        { method: 'DELETE' },
      );
    },
    onSuccess: () => {
      if (removeFromListId) {
        void qc.invalidateQueries({ queryKey: ['list', removeFromListId] });
      }
      void qc.invalidateQueries({ queryKey: ['entries'] });
      void qc.invalidateQueries({ queryKey: ['lists'] });
      toast.success('Removed from list');
    },
    onError: () => toast.error('Failed to remove'),
  });

  return (
    <>
      <Card className="overflow-hidden flex flex-col py-0 gap-0">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="text-left group/cover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-xl"
          aria-label={`Open details for ${anime.title}`}
        >
          <div className="relative aspect-2/3 bg-muted">
            {anime.imageUrl ? (
              <Image
                src={anime.imageUrl}
                alt={anime.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                className="object-cover transition-transform group-hover/cover:scale-[1.02]"
              />
            ) : null}
          </div>
        </button>
        <div className="p-3 flex-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="text-left font-medium text-sm leading-tight line-clamp-2 hover:underline focus-visible:outline-none focus-visible:underline"
            title={anime.title}
          >
            {anime.title}
          </button>
          <div className="text-xs text-muted-foreground">
            {anime.episodes ? `${anime.episodes} ep` : 'unknown ep'}
            {anime.year ? ` · ${anime.year}` : ''}
            {entry.userScore ? ` · You: ${entry.userScore}/10` : ''}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <StatusBadge status={entry.status} />
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button size="sm" variant="outline" className="flex-1">
                      Status
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  {STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => updateStatus.mutate(s)}>
                      {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => archive.mutate()}
                disabled={archive.isPending}
              >
                {entry.archived ? 'Unarchive' : 'Archive'}
              </Button>
              {removeFromListId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFromList.mutate()}
                  disabled={removeFromList.isPending}
                  title="Remove from this list (entry stays in your library)"
                >
                  {removeFromList.isPending ? '…' : 'Remove'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
      <EntryDetailDialog
        entry={entry}
        anime={anime}
        listIds={listIds}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
