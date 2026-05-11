import Image from 'next/image';

import { StatusBadge } from '@/components/rolodex/StatusBadge';
import type { ListSnapshot } from '@/lib/shares';
import { ReactionBar } from './ReactionBar';
import { SaveFromShareButton } from './SaveFromShareButton';
import { SignupCTA } from './SignupCTA';

interface Props {
  token: string;
  snapshot: ListSnapshot;
  take: string | null;
  includeScore: boolean;
  counts: { heart: number; eyes: number; nope: number };
  mine: 'heart' | 'eyes' | 'nope' | null;
  viewerAuthed: boolean;
  viewerOwnsShare: boolean;
  currentPath: string;
}

export function PublicListView({
  token,
  snapshot,
  take,
  includeScore,
  counts,
  mine,
  viewerAuthed,
  viewerOwnsShare,
  currentPath,
}: Props) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">A list of</p>
        <h1 className="text-3xl font-semibold tracking-tight">{snapshot.name}</h1>
        {snapshot.description ? (
          <p className="text-sm text-muted-foreground">{snapshot.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {snapshot.entries.length} {snapshot.entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </header>

      {take ? (
        <blockquote className="border-l-2 border-primary/60 pl-4 italic text-base leading-relaxed">
          “{take}”
        </blockquote>
      ) : null}

      {snapshot.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">This list was empty when shared.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {snapshot.entries.map((m) => (
            <li
              key={m.malId}
              className="flex flex-col gap-2 rounded-md overflow-hidden border border-border/40 bg-card"
            >
              <div className="relative aspect-2/3 bg-muted">
                {m.imageUrl ? (
                  <Image
                    src={m.imageUrl}
                    alt={m.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-tight line-clamp-2" title={m.title}>
                  {m.title}
                </p>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <StatusBadge status={m.status} className="text-[10px] px-1.5 py-0" />
                  {includeScore && m.userScore ? (
                    <span className="text-amber-300/90">★ {m.userScore}/10</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          React
        </h2>
        <ReactionBar token={token} initialCounts={counts} initialMine={mine} />
      </section>

      {viewerAuthed && !viewerOwnsShare ? (
        <SaveFromShareButton token={token} kind="list" />
      ) : null}
      {!viewerAuthed ? <SignupCTA currentPath={currentPath} context="list" /> : null}
    </div>
  );
}
