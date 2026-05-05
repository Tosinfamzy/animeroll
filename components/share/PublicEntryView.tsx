import Image from 'next/image';

import type { EntrySnapshot } from '@/lib/shares';
import { StatusBadge } from '@/components/rolodex/StatusBadge';
import { ReactionBar } from './ReactionBar';
import { SignupCTA } from './SignupCTA';

interface Props {
  token: string;
  snapshot: EntrySnapshot;
  take: string | null;
  counts: { heart: number; eyes: number; nope: number };
  mine: 'heart' | 'eyes' | 'nope' | null;
}

export function PublicEntryView({ token, snapshot, take, counts, mine }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">
      <article className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
        <div className="relative aspect-2/3 bg-muted rounded-lg overflow-hidden shadow-lg">
          {snapshot.imageUrl ? (
            <Image
              src={snapshot.imageUrl}
              alt={snapshot.title}
              fill
              priority
              sizes="200px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <header className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{snapshot.title}</h1>
            {snapshot.titleEnglish && snapshot.titleEnglish !== snapshot.title ? (
              <p className="text-sm text-muted-foreground">{snapshot.titleEnglish}</p>
            ) : null}
          </header>

          <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
            <StatusBadge status={snapshot.status} />
            {snapshot.userScore ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/30">
                ★ {snapshot.userScore}/10
              </span>
            ) : null}
            <span>{snapshot.episodes ? `${snapshot.episodes} eps` : 'unknown eps'}</span>
            {snapshot.year ? <span>· {snapshot.year}</span> : null}
            {snapshot.durationMinutes ? <span>· {snapshot.durationMinutes} min/ep</span> : null}
          </div>

          {take ? (
            <blockquote className="border-l-2 border-primary/60 pl-4 italic text-base leading-relaxed">
              “{take}”
            </blockquote>
          ) : null}

          {snapshot.genres.length ? (
            <div className="flex flex-wrap gap-1.5">
              {snapshot.genres.map((g) => (
                <span
                  key={g}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
          ) : null}

          {snapshot.synopsis ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground select-none">
                Synopsis
              </summary>
              <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{snapshot.synopsis}</p>
            </details>
          ) : null}
        </div>
      </article>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          React
        </h2>
        <ReactionBar token={token} initialCounts={counts} initialMine={mine} />
      </section>

      <SignupCTA />
    </div>
  );
}
