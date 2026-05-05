'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ListWithCount } from '@/lib/types';
import { CreateListDialog } from './CreateListDialog';

interface Props {
  entryId: string;
  listIds: string[];
}

export function AddToListMenu({ entryId, listIds }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const lists = useQuery<{ data: ListWithCount[] }>({
    queryKey: ['lists'],
    queryFn: async () => {
      const res = await fetch('/api/lists');
      if (!res.ok) throw new Error('lists_load_failed');
      return res.json();
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ listId, add }: { listId: string; add: boolean }) => {
      const url = add
        ? `/api/lists/${listId}/entries`
        : `/api/lists/${listId}/entries?entryId=${encodeURIComponent(entryId)}`;
      const res = await fetch(url, {
        method: add ? 'POST' : 'DELETE',
        headers: add ? { 'content-type': 'application/json' } : undefined,
        body: add ? JSON.stringify({ entryId }) : undefined,
      });
      if (!res.ok) throw new Error(add ? 'add_failed' : 'remove_failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['lists'] });
      qc.invalidateQueries({ queryKey: ['list'] });
    },
    onError: () => toast.error('Failed to update list membership'),
  });

  const all = lists.data?.data ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              Lists{listIds.length > 0 ? ` (${listIds.length})` : ''}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Add to lists</DropdownMenuLabel>
          {lists.isLoading ? (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          ) : all.length === 0 ? (
            <DropdownMenuItem disabled>No lists yet — create one below</DropdownMenuItem>
          ) : (
            all.map((l) => (
              <DropdownMenuCheckboxItem
                key={l.list.id}
                checked={listIds.includes(l.list.id)}
                closeOnClick={false}
                onCheckedChange={(next) => toggle.mutate({ listId: l.list.id, add: next })}
              >
                <span className="truncate flex-1">{l.list.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{l.entryCount}</span>
              </DropdownMenuCheckboxItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>+ New list…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateListDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(list) => toggle.mutate({ listId: list.list.id, add: true })}
      />
    </>
  );
}
