'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { jsonFetch } from '@/lib/api/fetch-json';
import type { ListWithCount } from '@/lib/types';

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost';
  onCreated?: (list: ListWithCount) => void;
}

export function CreateListDialog({
  open: controlledOpen,
  onOpenChange: controlledOnChange,
  triggerLabel = 'Create list',
  triggerVariant = 'default',
  onCreated,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) controlledOnChange?.(v);
    else setInternalOpen(v);
  };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      jsonFetch<{ data: ListWithCount }>('/api/lists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      }),
    onSuccess: ({ data }) => {
      void qc.invalidateQueries({ queryKey: ['lists'] });
      toast.success(`Created “${data.list.name}”`);
      setOpen(false);
      setName('');
      setDescription('');
      onCreated?.(data);
    },
    onError: () => toast.error('Failed to create list'),
  });

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 80 && !create.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v && !create.isPending) {
          setName('');
          setDescription('');
        }
      }}
    >
      {!isControlled ? (
        <DialogTrigger render={<Button variant={triggerVariant}>{triggerLabel}</Button>} />
      ) : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New list</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) create.mutate();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Name (≤80 chars)</span>
            <Input
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Current rotation"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Description (optional)</span>
            <Textarea
              rows={2}
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What ties these together?"
            />
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
