'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { jsonFetch } from '@/lib/api/fetch-json';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'watching' | 'completed' | 'plan';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Everything',
  watching: 'Watching',
  completed: 'Completed',
  plan: 'Plan to Watch',
};

export type ImportSource = 'mal' | 'anilist';

const SOURCES: Record<
  ImportSource,
  { label: string; full: string; endpoint: string; placeholder: string }
> = {
  mal: {
    label: 'MAL',
    full: 'MyAnimeList',
    endpoint: '/api/import/mal',
    placeholder: 'e.g. xinil',
  },
  anilist: {
    label: 'AniList',
    full: 'AniList',
    endpoint: '/api/import/anilist',
    placeholder: 'e.g. josh',
  },
};

interface ImportResponse {
  data: { added: number; skipped: number; total: number; username: string };
}

export function ImportLibraryDialog({ source }: { source: ImportSource }) {
  const cfg = SOURCES[source];
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const qc = useQueryClient();

  const importMut = useMutation({
    mutationFn: () =>
      jsonFetch<ImportResponse>(cfg.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), filter }),
      }),
    onSuccess: ({ data }) => {
      void qc.invalidateQueries({ queryKey: ['entries'] });
      const parts: string[] = [];
      if (data.added > 0) parts.push(`Added ${data.added.toString()}`);
      if (data.skipped > 0) parts.push(`${data.skipped.toString()} already in library`);
      if (data.total === 0) parts.push('Nothing to import');
      toast.success(`Imported from ${data.username}: ${parts.join(' · ')}`);
      setOpen(false);
      setUsername('');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('404')) {
        toast.error(`${cfg.full} user "${username.trim()}" not found`);
      } else if (msg.includes('429')) {
        toast.error('Slow down — too many imports. Try again in a minute.');
      } else {
        toast.error(`Import failed. ${cfg.full} might be having a moment.`);
      }
    },
  });

  const trimmed = username.trim();
  const canSubmit = trimmed.length > 0 && !importMut.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v && !importMut.isPending) setUsername('');
      }}
    >
      <DialogTrigger render={<Button variant="outline">Import from {cfg.label}</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from {cfg.full}</DialogTitle>
          <DialogDescription>
            Pulls a public {cfg.full} list into your library. Existing entries are kept
            untouched — only new ones are added.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) importMut.mutate();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{cfg.full} username</span>
            <Input
              autoFocus
              placeholder={cfg.placeholder}
              value={username}
              maxLength={40}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs text-muted-foreground mb-1">Filter</legend>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full border transition-colors',
                    filter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted',
                  )}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Imports may take a few seconds for large lists. You can keep using
            the app while it runs.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {importMut.isPending ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
