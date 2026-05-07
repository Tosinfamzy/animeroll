'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { jsonFetch } from '@/lib/api/fetch-json';

interface Props {
  token: string;
  kind: 'entry' | 'list';
}

interface EntrySaveResponse {
  data: { added: boolean; entryId: string | null; total: number };
}

interface ListSaveResponse {
  data: {
    addedCount: number;
    existedCount: number;
    upstreamFailures: number;
    total: number;
  };
}

export function SaveFromShareButton({ token, kind }: Props) {
  const save = useMutation({
    mutationFn: () =>
      jsonFetch<EntrySaveResponse | ListSaveResponse>(`/api/shares/${token}/save`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      if (kind === 'entry') {
        const { added } = (res as EntrySaveResponse).data;
        toast.success(added ? 'Added to your library' : 'Already in your library');
        return;
      }
      const { addedCount, existedCount, upstreamFailures, total } = (res as ListSaveResponse).data;
      if (addedCount === 0 && existedCount === total) {
        toast.info(`All ${total.toString()} already in your library`);
      } else if (addedCount === total) {
        toast.success(`Added ${total.toString()} to your library`);
      } else {
        const parts: string[] = [`Added ${addedCount.toString()} of ${total.toString()}`];
        if (existedCount > 0) parts.push(`${existedCount.toString()} already in library`);
        if (upstreamFailures > 0) parts.push(`${upstreamFailures.toString()} failed`);
        toast.success(parts.join(' · '));
      }
    },
    onError: () => toast.error('Failed to save'),
  });

  return (
    <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
      {save.isPending
        ? 'Saving…'
        : kind === 'list'
          ? 'Save all entries to my library'
          : 'Add to my library'}
    </Button>
  );
}
