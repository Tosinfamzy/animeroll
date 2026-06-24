'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { jsonFetch } from '@/lib/api/fetch-json';
import { summarizeReactions } from '@/lib/reactions';
import { cn } from '@/lib/utils';

import type { MyShareRow } from '@/app/api/shares/me/route';

const ICONS = { heart: '❤️', eyes: '👀', nope: '🚫' } as const;

interface ReactionDrillDown {
  token: string;
  counts: { heart: number; eyes: number; nope: number };
  recent: { kind: 'heart' | 'eyes' | 'nope'; at: string }[];
  truncated: boolean;
}

export function SharesView() {
  const qc = useQueryClient();

  const q = useQuery<{ data: MyShareRow[] }>({
    queryKey: ['my-shares'],
    queryFn: () => jsonFetch<{ data: MyShareRow[] }>('/api/shares/me'),
  });

  const revoke = useMutation({
    mutationFn: (token: string) =>
      jsonFetch<{ data: { token: string; revokedAt: string } }>(
        `/api/shares/${token}/revoke`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-shares'] });
      toast.success('Share revoked. The link no longer resolves.');
    },
    onError: () => toast.error('Failed to revoke'),
  });

  const editTake = useMutation({
    mutationFn: ({ token, take }: { token: string; take: string | null }) =>
      jsonFetch<{ data: { token: string; take: string | null } }>(`/api/shares/${token}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ take }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-shares'] });
      toast.success('Take updated');
    },
    onError: () => toast.error('Failed to update take'),
  });

  const toggleScore = useMutation({
    mutationFn: ({ token, includeScore }: { token: string; includeScore: boolean }) =>
      jsonFetch<{ data: { token: string; includeScore: boolean } }>(`/api/shares/${token}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ includeScore }),
      }),
    onMutate: async ({ token, includeScore }) => {
      await qc.cancelQueries({ queryKey: ['my-shares'] });
      const previous = qc.getQueryData<{ data: MyShareRow[] }>(['my-shares']);
      if (previous) {
        qc.setQueryData<{ data: MyShareRow[] }>(['my-shares'], {
          data: previous.data.map((row) =>
            row.token === token ? { ...row, includeScore } : row,
          ),
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(['my-shares'], ctx.previous);
      toast.error('Failed to update');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['my-shares'] });
    },
  });

  const resnapshot = useMutation({
    mutationFn: (token: string) =>
      jsonFetch<{ data: { token: string; resnapshottedAt: string } }>(
        `/api/shares/${token}/resnapshot`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-shares'] });
      toast.success('Snapshot refreshed. Recipients see the new state.');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && err.message.includes('410')
          ? 'Original entry/list was deleted; nothing to re-snapshot.'
          : 'Failed to re-snapshot';
      toast.error(msg);
    },
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">Failed to load your shares.</p>;

  const rows = q.data?.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>You haven&rsquo;t shared anything yet.</p>
        <p className="text-xs mt-2">
          From any anime card, click the cover &rarr; &ldquo;Share&rdquo; to generate a link.
        </p>
      </div>
    );
  }

  const active = rows.filter((r) => !r.revokedAt);
  const revoked = rows.filter((r) => r.revokedAt);

  return (
    <div className="flex flex-col gap-8">
      <ReactionRollup rows={active} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active shares.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((r) => (
              <ShareRow
                key={r.token}
                row={r}
                onRevoke={() => {
                  if (
                    confirm(
                      `Revoke this share? Anyone with the link will see a 404. You can’t undo this.`,
                    )
                  ) {
                    revoke.mutate(r.token);
                  }
                }}
                onResnapshot={() => resnapshot.mutate(r.token)}
                onEditTake={(take) => editTake.mutate({ token: r.token, take })}
                onToggleScore={(includeScore) =>
                  toggleScore.mutate({ token: r.token, includeScore })
                }
                pending={
                  (revoke.isPending && revoke.variables === r.token) ||
                  (resnapshot.isPending && resnapshot.variables === r.token) ||
                  (editTake.isPending && editTake.variables.token === r.token) ||
                  (toggleScore.isPending && toggleScore.variables.token === r.token)
                }
              />
            ))}
          </div>
        )}
      </section>

      {revoked.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Revoked ({revoked.length})
          </h2>
          <div className="flex flex-col gap-3">
            {revoked.map((r) => (
              <ShareRow key={r.token} row={r} pending={false} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReactionRollup({ rows }: { rows: MyShareRow[] }) {
  const summary = summarizeReactions(rows);
  if (summary.totalShares === 0) return null;

  const top = summary.topShareToken
    ? rows.find((r) => r.token === summary.topShareToken)
    : undefined;
  const topTitle = top
    ? top.preview.kind === 'entry'
      ? top.preview.title
      : top.preview.name
    : null;

  return (
    <Card className="p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
      <Stat label="Reactions" value={summary.totalReactions} />
      <Stat
        label="Shares with reactions"
        value={`${summary.sharesWithReactions.toString()} / ${summary.totalShares.toString()}`}
      />
      <div className="flex items-center gap-3 text-sm">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">By kind</span>
        <span>{ICONS.heart} {summary.byKind.heart}</span>
        <span>{ICONS.eyes} {summary.byKind.eyes}</span>
        <span>{ICONS.nope} {summary.byKind.nope}</span>
      </div>
      {topTitle ? (
        <div className="text-sm min-w-0">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">
            Most reactions
          </span>
          <span className="font-medium truncate">{topTitle}</span>
        </div>
      ) : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
        {label}
      </span>
    </div>
  );
}

function ReactionActivity({ token }: { token: string }) {
  const q = useQuery<{ data: ReactionDrillDown }>({
    queryKey: ['share-reactions', token],
    queryFn: () => jsonFetch<{ data: ReactionDrillDown }>(`/api/shares/${token}/reactions`),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading activity…</p>;
  }
  if (q.isError) {
    return <p className="text-xs text-destructive">Couldn’t load reaction activity.</p>;
  }
  const recent = q.data?.data.recent ?? [];
  if (recent.length === 0) {
    return <p className="text-xs text-muted-foreground">No reactions on this share yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {recent.map((r, i) => (
        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden>{ICONS[r.kind]}</span>
          <span className="capitalize">{r.kind}</span>
          <span className="opacity-60">·</span>
          <span>{relativeTime(r.at)}</span>
        </li>
      ))}
      {q.data?.data.truncated ? (
        <li className="text-xs text-muted-foreground/60">Showing the 50 most recent.</li>
      ) : null}
    </ul>
  );
}

function ShareRow({
  row,
  onRevoke,
  onResnapshot,
  onEditTake,
  onToggleScore,
  pending,
}: {
  row: MyShareRow;
  onRevoke?: () => void;
  onResnapshot?: () => void;
  onEditTake?: (take: string | null) => void;
  onToggleScore?: (includeScore: boolean) => void;
  pending: boolean;
}) {
  const isRevoked = row.revokedAt !== null;
  const total = row.counts.heart + row.counts.eyes + row.counts.nope;
  const [editingTake, setEditingTake] = useState(false);
  const [draftTake, setDraftTake] = useState('');
  const [showActivity, setShowActivity] = useState(false);

  return (
    <Card
      className={cn(
        'p-4 flex flex-col sm:flex-row gap-4 items-start',
        isRevoked && 'opacity-60',
      )}
    >
      <div className="shrink-0">
        {row.preview.kind === 'entry' ? (
          <div className="relative aspect-2/3 w-20 rounded-md overflow-hidden bg-muted">
            {row.preview.imageUrl ? (
              <Image
                src={row.preview.imageUrl}
                alt={row.preview.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 w-20">
            {row.preview.covers.slice(0, 4).map((src, i) => (
              <div
                key={i}
                className="relative aspect-square rounded overflow-hidden bg-muted"
              >
                {src ? (
                  <Image src={src} alt="" fill sizes="40px" className="object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-sm leading-tight truncate">
            {row.preview.kind === 'entry' ? row.preview.title : row.preview.name}
          </h3>
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider',
              row.kind === 'list'
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {row.kind}
          </span>
          {row.preview.kind === 'list' ? (
            <span className="text-xs text-muted-foreground">
              {row.preview.entryCount} entries
            </span>
          ) : null}
          {isRevoked ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
              Revoked
            </span>
          ) : null}
        </div>

        {editingTake && onEditTake ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = draftTake.trim();
              onEditTake(trimmed === '' ? null : trimmed);
              setEditingTake(false);
            }}
          >
            <Textarea
              autoFocus
              rows={2}
              maxLength={280}
              value={draftTake}
              onChange={(e) => setDraftTake(e.target.value)}
              placeholder="best fight choreography of the decade"
            />
            <div className="flex gap-2 self-start text-xs">
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditingTake(false)}
              >
                Cancel
              </Button>
              <span className="text-muted-foreground self-center tabular-nums">
                {draftTake.length}/280
              </span>
            </div>
          </form>
        ) : row.take ? (
          (() => {
            const take = row.take;
            return (
              <button
                type="button"
                onClick={
                  onEditTake
                    ? () => {
                        setDraftTake(take);
                        setEditingTake(true);
                      }
                    : undefined
                }
                disabled={!onEditTake}
                className="text-left text-sm italic text-foreground/80 line-clamp-2 hover:text-foreground transition-colors disabled:cursor-default"
                title={onEditTake ? 'Click to edit take' : undefined}
              >
                &ldquo;{take}&rdquo;
              </button>
            );
          })()
        ) : onEditTake ? (
          <button
            type="button"
            onClick={() => {
              setDraftTake('');
              setEditingTake(true);
            }}
            className="text-left text-sm italic text-muted-foreground/60 hover:text-muted-foreground transition-colors self-start"
          >
            + Add a take
          </button>
        ) : null}

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>{relativeTime(row.createdAt)}</span>
          {total > 0 ? (
            <button
              type="button"
              onClick={() => setShowActivity((v) => !v)}
              aria-expanded={showActivity}
              className="flex items-center gap-2 hover:text-foreground transition-colors"
              title="Show recent reaction activity"
            >
              <span aria-label={`${row.counts.heart.toString()} hearts`}>
                {ICONS.heart} {row.counts.heart}
              </span>
              <span aria-label={`${row.counts.eyes.toString()} eyes`}>
                {ICONS.eyes} {row.counts.eyes}
              </span>
              <span aria-label={`${row.counts.nope.toString()} not for me`}>
                {ICONS.nope} {row.counts.nope}
              </span>
              <span className="opacity-60 text-[10px]">{showActivity ? '▲' : '▼'}</span>
            </button>
          ) : (
            <span className="opacity-70">No reactions yet</span>
          )}
          {onToggleScore ? (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={row.includeScore}
                disabled={pending}
                onChange={(e) => onToggleScore(e.target.checked)}
              />
              <span>
                {row.kind === 'list' ? 'Show scores' : 'Show my score'}
              </span>
            </label>
          ) : null}
        </div>

        {showActivity && total > 0 ? (
          <div className="mt-1 rounded-md border border-border/60 bg-muted/30 p-2">
            <ReactionActivity token={row.token} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {!isRevoked ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(row.url).catch(() => undefined);
                toast.success('Copied to clipboard');
              }}
            >
              Copy
            </Button>
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-sm h-7 px-2.5 rounded-md border border-border hover:bg-muted transition-colors"
            >
              Open
            </a>
            {onResnapshot ? (
              <Button size="sm" variant="ghost" onClick={onResnapshot} disabled={pending}>
                Re-snapshot
              </Button>
            ) : null}
            {onRevoke ? (
              <Button size="sm" variant="ghost" onClick={onRevoke} disabled={pending}>
                Revoke
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min).toString()}m ago`;
  if (diff < day) return `${Math.floor(diff / hr).toString()}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day).toString()}d ago`;
  return new Date(iso).toLocaleDateString();
}
