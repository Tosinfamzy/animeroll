'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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

interface Props {
  kind: 'entry' | 'list';
  entryId?: string;
  listId?: string;
  subjectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShareResponse {
  data: { token: string; url: string; kind: 'entry' | 'list' };
}

export function ShareDialog({
  kind,
  entryId,
  listId,
  subjectName,
  open,
  onOpenChange,
}: Props) {
  const [take, setTake] = useState('');
  const [generated, setGenerated] = useState<{ url: string; token: string } | null>(null);

  const generate = useMutation({
    mutationFn: async (): Promise<ShareResponse> => {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          entryId,
          listId,
          take: take.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ShareResponse>;
    },
    onSuccess: ({ data }) => {
      setGenerated({ url: data.url, token: data.token });
      navigator.clipboard.writeText(data.url).catch(() => {
        // Clipboard may fail in some contexts; fall back silently.
      });
      toast.success('Share link copied to clipboard');
    },
    onError: () => toast.error('Failed to create share'),
  });

  const reset = () => {
    setTake('');
    setGenerated(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v && !generate.isPending) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">
            Share {kind === 'list' ? 'this list' : subjectName}
          </DialogTitle>
          <DialogDescription className="text-left">
            Public link, no signup required. Snapshots {kind === 'list' ? 'the list and its members' : 'title, cover, and your score'} at this moment.
          </DialogDescription>
        </DialogHeader>

        {generated ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={generated.url} />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(generated.url).catch(() => {});
                  toast.success('Copied');
                }}
              >
                Copy
              </Button>
            </div>
            <div className="flex justify-between items-center">
              <a
                href={generated.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline text-muted-foreground hover:text-foreground"
              >
                Open in new tab
              </a>
              <Button variant="ghost" onClick={reset}>
                New share
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!generate.isPending) generate.mutate();
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                One-line take (optional, ≤280 chars)
              </span>
              <Textarea
                rows={3}
                maxLength={280}
                value={take}
                onChange={(e) => setTake(e.target.value)}
                placeholder="best fight choreography of the decade"
              />
              <span className="text-xs text-muted-foreground tabular-nums self-end">
                {take.length}/280
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generate.isPending}>
                {generate.isPending ? 'Generating…' : 'Generate share link'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
