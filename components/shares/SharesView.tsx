'use client';

import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { jsonFetch } from '@/lib/api/fetch-json';
import { cn } from '@/lib/utils';

import type { MyShareRow } from '@/app/api/shares/me/route';

const ICONS = { heart: '❤️', eyes: '👀', nope: '🚫' } as const;

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
                pending={
                  (revoke.isPending && revoke.variables === r.token) ||
                  (resnapshot.isPending && resnapshot.variables === r.token)
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

function ShareRow({
  row,
  onRevoke,
  onResnapshot,
  pending,
}: {
  row: MyShareRow;
  onRevoke?: () => void;
  onResnapshot?: () => void;
  pending: boolean;
}) {
  const isRevoked = row.revokedAt !== null;
  const total = row.counts.heart + row.counts.eyes + row.counts.nope;

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

        {row.take ? (
          <p className="text-sm italic text-foreground/80 line-clamp-2">
            &ldquo;{row.take}&rdquo;
          </p>
        ) : null}

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>{relativeTime(row.createdAt)}</span>
          {total > 0 ? (
            <span className="flex items-center gap-2">
              <span aria-label={`${row.counts.heart.toString()} hearts`}>
                {ICONS.heart} {row.counts.heart}
              </span>
              <span aria-label={`${row.counts.eyes.toString()} eyes`}>
                {ICONS.eyes} {row.counts.eyes}
              </span>
              <span aria-label={`${row.counts.nope.toString()} not for me`}>
                {ICONS.nope} {row.counts.nope}
              </span>
            </span>
          ) : (
            <span className="opacity-70">No reactions yet</span>
          )}
        </div>
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
