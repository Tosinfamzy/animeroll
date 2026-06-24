'use client';

import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { jsonFetch } from '@/lib/api/fetch-json';
import type { Stats } from '@/lib/stats';
import type { Status } from '@/lib/db/schema';

const STATUS_LABELS: Record<Status, string> = {
  plan: 'Plan to watch',
  watching: 'Watching',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On hold',
};

const STATUS_ORDER: Status[] = ['watching', 'completed', 'on_hold', 'dropped', 'plan'];

export function StatsView() {
  const q = useQuery<{ data: Stats }>({
    queryKey: ['stats'],
    queryFn: () => jsonFetch<{ data: Stats }>('/api/stats'),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">Failed to load your stats.</p>;

  const s = q.data?.data;
  if (!s || s.total === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No stats yet.</p>
        <p className="text-xs mt-2">
          Add a few anime to your library and rate them — your stats build from there.
        </p>
      </div>
    );
  }

  const delta = s.scoreDeltaVsCommunity;

  return (
    <div className="flex flex-col gap-6">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat label="In library" value={s.total} />
        <Stat label="Completion rate" value={`${Math.round(s.completionRate * 100).toString()}%`} />
        <Stat label="Episodes watched" value={s.totalEpisodes.toLocaleString()} />
        <Stat label="Mean score" value={s.meanUserScore ?? '—'} />
        <Stat
          label="vs. community"
          value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toString()}`}
          hint={
            delta === null
              ? undefined
              : delta > 0
                ? 'you rate higher'
                : delta < 0
                  ? 'you rate lower'
                  : 'dead even'
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-medium mb-3">By status</h2>
          <BarList
            items={STATUS_ORDER.filter((st) => s.byStatus[st] > 0).map((st) => ({
              label: STATUS_LABELS[st],
              value: s.byStatus[st],
            }))}
          />
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-medium mb-3">Score distribution</h2>
          {s.scoreDistribution.every((d) => d.count === 0) ? (
            <p className="text-xs text-muted-foreground">No scored entries yet.</p>
          ) : (
            <BarList
              items={s.scoreDistribution.map((d) => ({
                label: d.score.toString(),
                value: d.count,
              }))}
            />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-medium mb-3">Top genres</h2>
          {s.topGenres.length === 0 ? (
            <p className="text-xs text-muted-foreground">No genre data yet.</p>
          ) : (
            <BarList items={s.topGenres.map((g) => ({ label: g.genre, value: g.count }))} />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-medium mb-3">Completions by year</h2>
          {s.completionsByYear.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing completed yet.</p>
          ) : (
            <BarList
              items={s.completionsByYear.map((y) => ({
                label: y.year.toString(),
                value: y.count,
              }))}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-3 flex flex-col">
      <span className="text-2xl font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-xs uppercase tracking-wider text-muted-foreground mt-1.5">
        {label}
      </span>
      {hint ? <span className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</span> : null}
    </Card>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-muted-foreground">{i.label}</span>
          <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded"
              style={{ width: `${Math.max(2, (i.value / max) * 100).toString()}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}
