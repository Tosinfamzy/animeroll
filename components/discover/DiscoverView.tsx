'use client';

import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { jsonFetch } from '@/lib/api/fetch-json';
import type { Recommendation } from '@/lib/recommend';

interface RecommendationsResponse {
  data: { recommendations: Recommendation[]; coldStart: boolean };
}

export function DiscoverView() {
  const qc = useQueryClient();

  const q = useQuery<RecommendationsResponse>({
    queryKey: ['recommendations'],
    queryFn: () => jsonFetch<RecommendationsResponse>('/api/recommendations'),
    // Recommendations fan out to Jikan; don't refetch them eagerly.
    staleTime: 5 * 60_000,
  });

  const add = useMutation({
    mutationFn: (malId: number) =>
      jsonFetch<{ data: unknown; existed: boolean }>('/api/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ malId }),
      }),
    onSuccess: (res, malId) => {
      void qc.invalidateQueries({ queryKey: ['entries'] });
      // Drop the added title from the current suggestions.
      qc.setQueryData<RecommendationsResponse>(['recommendations'], (prev) =>
        prev
          ? {
              data: {
                ...prev.data,
                recommendations: prev.data.recommendations.filter((r) => r.malId !== malId),
              },
            }
          : prev,
      );
      toast.success(res.existed ? 'Already in your library' : 'Added to your library');
    },
    onError: () => toast.error('Could not add — try again.'),
  });

  if (q.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Building suggestions… this can take a few seconds the first time.
      </p>
    );
  }
  if (q.isError) return <p className="text-sm text-destructive">Failed to load suggestions.</p>;

  const data = q.data?.data;
  if (data?.coldStart) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Not enough to go on yet.</p>
        <p className="text-xs mt-2">
          Complete or rate a few titles (7+), and recommendations will build from there.
        </p>
      </div>
    );
  }

  const recs = data?.recommendations ?? [];
  if (recs.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No fresh suggestions right now.</p>
        <p className="text-xs mt-2">Rate a few more titles and check back.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {recs.map((r) => (
        <Card key={r.malId} className="overflow-hidden flex flex-col">
          <div className="relative aspect-2/3 bg-muted">
            {r.imageUrl ? (
              <Image
                src={r.imageUrl}
                alt={r.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
            ) : null}
            {r.meanScore !== null ? (
              <span className="absolute top-1.5 right-1.5 text-[11px] px-1.5 py-0.5 rounded bg-black/70 text-white tabular-nums">
                ★ {r.meanScore.toFixed(1)}
              </span>
            ) : null}
          </div>
          <div className="p-3 flex flex-col gap-2 flex-1">
            <h3 className="text-sm font-medium leading-tight line-clamp-2">{r.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{reasonText(r)}</p>
            <Button
              size="sm"
              variant="outline"
              disabled={add.isPending && add.variables === r.malId}
              onClick={() => add.mutate(r.malId)}
            >
              {add.isPending && add.variables === r.malId ? 'Adding…' : 'Add to library'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function reasonText(r: Recommendation): string {
  const parts: string[] = [];
  if (r.coRecommendCount > 0) {
    parts.push(
      r.coRecommendCount === 1
        ? 'Recommended alongside one you liked'
        : `Recommended alongside ${r.coRecommendCount.toString()} you liked`,
    );
  }
  if (r.reasonGenres.length > 0) {
    parts.push(`shares ${r.reasonGenres.join(', ')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Picked for you';
}
