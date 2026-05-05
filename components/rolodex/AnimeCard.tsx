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
import { STATUSES, type Status } from '@/lib/db/schema';
import type { EntryWithAnime } from '@/lib/types';
import { EntryDetailDialog } from './EntryDetailDialog';
import { STATUS_LABELS, StatusBadge } from './StatusBadge';

export function AnimeCard({ entry, anime, listIds }: EntryWithAnime) {
  const qc = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async (status: Status) => {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('update_failed');
      return res.json();
    },
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
    onSettled: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  });

  const archive = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !entry.archived }),
      });
      if (!res.ok) throw new Error('archive_failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      toast.success(entry.archived ? 'Unarchived' : 'Archived');
    },
    onError: () => toast.error('Failed to archive'),
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
