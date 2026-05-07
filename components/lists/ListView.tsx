'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AnimeCard } from '@/components/rolodex/AnimeCard';
import { ShareDialog } from '@/components/share/ShareDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { jsonFetch } from '@/lib/api/fetch-json';
import type { ListWithMembers } from '@/lib/types';

interface Props {
  listId: string;
}

export function ListView({ listId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const q = useQuery<{ data: ListWithMembers }>({
    queryKey: ['list', listId],
    queryFn: () => jsonFetch<{ data: ListWithMembers }>(`/api/lists/${listId}`),
    retry: false,
  });

  const rename = useMutation({
    mutationFn: (name: string) =>
      jsonFetch<{ data: unknown }>(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['list', listId] });
      void qc.invalidateQueries({ queryKey: ['lists'] });
      setEditing(false);
      toast.success('Renamed');
    },
    onError: () => toast.error('Failed to rename'),
  });

  const remove = useMutation({
    mutationFn: () =>
      jsonFetch<{ data: unknown }>(`/api/lists/${listId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lists'] });
      toast.success('List deleted');
      router.push('/lists');
    },
    onError: () => toast.error('Failed to delete list'),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">List not found.</p>
        <Link href="/lists" className="text-sm underline mt-2 inline-block">
          Back to lists
        </Link>
      </div>
    );
  }

  const data = q.data?.data;
  if (!data) return null;
  const { list, members } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {editing ? (
            <form
              className="flex gap-2 items-center"
              onSubmit={(e) => {
                e.preventDefault();
                if (draftName.trim()) rename.mutate(draftName);
              }}
            >
              <Input
                autoFocus
                value={draftName}
                maxLength={80}
                onChange={(e) => setDraftName(e.target.value)}
                className="text-2xl font-semibold h-auto py-1.5"
              />
              <Button type="submit" size="sm" disabled={rename.isPending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(list.name);
                setEditing(true);
              }}
              className="text-left"
              title="Click to rename"
            >
              <h1 className="text-2xl font-semibold tracking-tight hover:text-foreground/80">
                {list.name}
              </h1>
            </button>
          )}
          {list.description ? (
            <p className="text-sm text-muted-foreground">{list.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-1">
            {members.length} {members.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setShareOpen(true)}>
            Share list
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete list “${list.name}”? Entries themselves are kept.`)) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
          >
            Delete list
          </Button>
        </div>
      </div>

      <ShareDialog
        kind="list"
        listId={list.id}
        subjectName={list.name}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />

      {members.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>This list is empty.</p>
          <p className="text-xs mt-2">
            Add entries from the library: open any card and pick this list.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {members.map((m) => (
            <AnimeCard key={m.entry.id} {...m} />
          ))}
        </div>
      )}
    </div>
  );
}
