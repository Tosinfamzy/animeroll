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
import { Textarea } from '@/components/ui/textarea';
import { jsonFetch } from '@/lib/api/fetch-json';
import type { ListWithMembers } from '@/lib/types';

interface Props {
  listId: string;
}

interface UpdateBody {
  name?: string;
  description?: string | null;
}

export function ListView({ listId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const q = useQuery<{ data: ListWithMembers }>({
    queryKey: ['list', listId],
    queryFn: () => jsonFetch<{ data: ListWithMembers }>(`/api/lists/${listId}`),
    retry: false,
  });

  const update = useMutation({
    mutationFn: (body: UpdateBody) =>
      jsonFetch<{ data: unknown }>(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['list', listId] });
      void qc.invalidateQueries({ queryKey: ['lists'] });
      if ('name' in vars) {
        setEditingName(false);
        toast.success('Renamed');
      }
      if ('description' in vars) {
        setEditingDesc(false);
        toast.success('Description updated');
      }
    },
    onError: () => toast.error('Failed to update list'),
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
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          {editingName ? (
            <form
              className="flex gap-2 items-center"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = draftName.trim();
                if (trimmed) update.mutate({ name: trimmed });
              }}
            >
              <Input
                autoFocus
                value={draftName}
                maxLength={80}
                onChange={(e) => setDraftName(e.target.value)}
                className="text-2xl font-semibold h-auto py-1.5"
              />
              <Button type="submit" size="sm" disabled={update.isPending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditingName(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftName(list.name);
                setEditingName(true);
              }}
              className="text-left"
              title="Click to rename"
            >
              <h1 className="text-2xl font-semibold tracking-tight hover:text-foreground/80">
                {list.name}
              </h1>
            </button>
          )}

          {editingDesc ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = draftDesc.trim();
                update.mutate({ description: trimmed === '' ? null : trimmed });
              }}
            >
              <Textarea
                autoFocus
                rows={2}
                maxLength={500}
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="What ties these together?"
              />
              <div className="flex gap-2 self-start">
                <Button type="submit" size="sm" disabled={update.isPending}>
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingDesc(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftDesc(list.description ?? '');
                setEditingDesc(true);
              }}
              className="text-left self-start"
              title={list.description ? 'Click to edit description' : 'Add a description'}
            >
              {list.description ? (
                <p className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {list.description}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                  Add a description
                </p>
              )}
            </button>
          )}

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
            <AnimeCard key={m.entry.id} {...m} removeFromListId={listId} />
          ))}
        </div>
      )}
    </div>
  );
}
