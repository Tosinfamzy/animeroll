'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

type Kind = 'heart' | 'eyes' | 'nope';

const ICONS: Record<Kind, string> = { heart: '❤️', eyes: '👀', nope: '🚫' };
const LABELS: Record<Kind, string> = {
  heart: 'Loved this',
  eyes: 'Curious',
  nope: 'Not for me',
};
const ORDER: readonly Kind[] = ['heart', 'eyes', 'nope'];

interface Counts {
  heart: number;
  eyes: number;
  nope: number;
}

interface Props {
  token: string;
  initialCounts: Counts;
  initialMine: Kind | null;
}

export function ReactionBar({ token, initialCounts, initialMine }: Props) {
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [mine, setMine] = useState<Kind | null>(initialMine);

  const react = useMutation({
    mutationFn: async (next: Kind | null) => {
      if (next === null) {
        const res = await fetch(`/api/shares/${token}/react`, { method: 'DELETE' });
        if (!res.ok) throw new Error('react_failed');
        return null;
      }
      const res = await fetch(`/api/shares/${token}/react`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: next }),
      });
      if (!res.ok) throw new Error('react_failed');
      return next;
    },
    onMutate: (next) => {
      const prev = mine;
      setMine(next);
      setCounts((c) => {
        const updated = { ...c };
        if (prev) updated[prev] = Math.max(0, updated[prev] - 1);
        if (next) updated[next] += 1;
        return updated;
      });
      return { prev, prevCounts: counts };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        setMine(ctx.prev);
        setCounts(ctx.prevCounts);
      }
      toast.error('Reaction failed');
    },
  });

  const handle = (k: Kind) => react.mutate(mine === k ? null : k);

  return (
    <div
      className="flex flex-wrap gap-2 items-center"
      role="group"
      aria-label="React to this share"
    >
      {ORDER.map((k) => {
        const active = mine === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => handle(k)}
            aria-label={LABELS[k]}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary/10 border-primary/50 text-foreground'
                : 'border-border hover:bg-muted',
            )}
          >
            <span className="text-base leading-none" aria-hidden>
              {ICONS[k]}
            </span>
            <span aria-live="polite" className="tabular-nums">
              {counts[k]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
