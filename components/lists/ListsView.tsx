'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import type { ListWithCount } from '@/lib/types';
import { CreateListDialog } from './CreateListDialog';

export function ListsView() {
  const q = useQuery<{ data: ListWithCount[] }>({
    queryKey: ['lists'],
    queryFn: async () => {
      const res = await fetch('/api/lists');
      if (!res.ok) throw new Error('lists_load_failed');
      return res.json();
    },
  });

  const lists = q.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {q.isLoading ? 'Loading…' : `${lists.length} ${lists.length === 1 ? 'list' : 'lists'}`}
        </p>
        <CreateListDialog />
      </div>

      {q.isLoading ? null : q.isError ? (
        <p className="text-sm text-destructive">Failed to load lists.</p>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No lists yet.</p>
          <p className="text-xs mt-2">
            Lists are curatorial: think “Current rotation” or “Top 10 of 2025”.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {lists.map((l) => (
            <Link key={l.list.id} href={`/lists/${l.list.id}`}>
              <Card className="p-5 hover:border-foreground/30 transition-colors h-full">
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium text-base leading-tight line-clamp-2">
                    {l.list.name}
                  </h3>
                  {l.list.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {l.list.description}
                    </p>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground mt-auto">
                  {l.entryCount} {l.entryCount === 1 ? 'entry' : 'entries'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
