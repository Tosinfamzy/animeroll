'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AddToListMenu } from '@/components/lists/AddToListMenu';
import { ShareDialog } from '@/components/share/ShareDialog';
import type { EntryWithAnime } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  entry: EntryWithAnime['entry'];
  anime: EntryWithAnime['anime'];
  listIds: EntryWithAnime['listIds'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PatchBody {
  userScore?: number | null;
  episodesWatched?: number;
  privateNotes?: string | null;
  status?: 'completed';
}

export function EntryDetailDialog({ entry, anime, listIds, open, onOpenChange }: Props) {
  const [score, setScore] = useState<string>(entry.userScore?.toString() ?? '');
  const [episodes, setEpisodes] = useState<string>(entry.episodesWatched.toString());
  const [notes, setNotes] = useState<string>(entry.privateNotes ?? '');
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setScore(entry.userScore?.toString() ?? '');
      setEpisodes(entry.episodesWatched.toString());
      setNotes(entry.privateNotes ?? '');
    }
  }, [open, entry.userScore, entry.episodesWatched, entry.privateNotes]);

  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const body: PatchBody = {};
      const parsedScore = score === '' ? null : Number(score);
      if (parsedScore !== entry.userScore) body.userScore = parsedScore;
      const parsedEps = Number(episodes);
      if (!Number.isNaN(parsedEps) && parsedEps !== entry.episodesWatched) {
        body.episodesWatched = parsedEps;
      }
      const trimmedNotes = notes.trim();
      const oldNotes = entry.privateNotes ?? '';
      if (trimmedNotes !== oldNotes) body.privateNotes = trimmedNotes === '' ? null : trimmedNotes;
      if (Object.keys(body).length === 0) return null;
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('save_failed');
      return res.json();
    },
    onSuccess: (data) => {
      if (!data) {
        toast.info('No changes to save');
        return;
      }
      qc.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  const markComplete = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'completed' } satisfies PatchBody),
      });
      if (!res.ok) throw new Error('complete_failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Marked completed');
    },
    onError: () => toast.error('Failed to mark complete'),
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/anime/${anime.malId}`, { method: 'POST' });
      if (!res.ok) throw new Error('refresh_failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Refreshed metadata from MAL');
    },
    onError: () => toast.error('Refresh failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-left">{anime.title}</DialogTitle>
          {anime.titleEnglish && anime.titleEnglish !== anime.title ? (
            <DialogDescription className="text-left">{anime.titleEnglish}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6">
          <div className="relative aspect-2/3 rounded-md overflow-hidden bg-muted shrink-0">
            {anime.imageUrl ? (
              <Image
                src={anime.imageUrl}
                alt={anime.title}
                fill
                sizes="160px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground items-center">
              <StatusBadge status={entry.status} />
              <span>{anime.episodes ? `${anime.episodes} eps` : 'unknown eps'}</span>
              {anime.durationMinutes ? <span>· {anime.durationMinutes} min/ep</span> : null}
              {anime.year ? <span>· {anime.year}</span> : null}
              {anime.meanScore ? <span>· MAL ★ {anime.meanScore.toFixed(2)}</span> : null}
            </div>
            {anime.genres.length ? (
              <div className="flex flex-wrap gap-1.5">
                {anime.genres.map((g) => (
                  <span
                    key={g}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Your score (1–10)</span>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="—"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Episodes watched</span>
                <Input
                  type="number"
                  min={0}
                  value={episodes}
                  onChange={(e) => setEpisodes(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                Private notes <span className="opacity-70">(never shown on shares)</span>
              </span>
              <Textarea
                rows={3}
                value={notes}
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you think?"
              />
            </label>
            {anime.synopsis ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground select-none">
                  Synopsis
                </summary>
                <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{anime.synopsis}</p>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                Save
              </Button>
              {entry.status !== 'completed' ? (
                <Button
                  variant="outline"
                  onClick={() => markComplete.mutate()}
                  disabled={markComplete.isPending}
                >
                  Mark complete
                </Button>
              ) : null}
              <AddToListMenu entryId={entry.id} listIds={listIds} />
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                Share
              </Button>
              <Button
                variant="ghost"
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending}
                className="ml-auto"
              >
                {refresh.isPending ? 'Refreshing…' : 'Refresh metadata'}
              </Button>
            </div>
            <ShareDialog
              kind="entry"
              entryId={entry.id}
              subjectName={anime.title}
              open={shareOpen}
              onOpenChange={setShareOpen}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
