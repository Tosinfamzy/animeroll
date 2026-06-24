import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';

import { PublicListView } from '@/components/share/PublicListView';
import { RecordShareView } from '@/components/share/RecordShareView';
import {
  loadReactionFor,
  loadShareByToken,
  loadShareReactionCounts,
} from '@/lib/share-loader';
import { REACTOR_COOKIE } from '@/lib/shares';

interface Props {
  params: Promise<{ token: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const loaded = await loadShareByToken(token);
  if (loaded?.kind !== 'list') {
    return { title: 'Share not found · Anime Rolodex' };
  }
  const description =
    loaded.share.take ??
    loaded.snapshot.description ??
    `${loaded.snapshot.entries.length} entries`;
  return {
    title: `${loaded.snapshot.name} · Anime Rolodex`,
    description,
    openGraph: {
      title: loaded.snapshot.name,
      description,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: loaded.snapshot.name,
      description,
    },
  };
}

export default async function SharedListPage({ params }: Props) {
  const { token } = await params;
  const loaded = await loadShareByToken(token);
  if (loaded?.kind !== 'list') notFound();

  const counts = await loadShareReactionCounts(token);
  const cookieStore = await cookies();
  const reactorId = cookieStore.get(REACTOR_COOKIE)?.value;
  const mine = reactorId ? await loadReactionFor(token, reactorId) : null;

  const { userId } = await auth();
  const viewerAuthed = userId !== null;
  const viewerOwnsShare = userId !== null && userId === loaded.share.createdBy;

  return (
    <>
      <RecordShareView token={token} skip={viewerOwnsShare} />
      <PublicListView
        token={token}
        snapshot={loaded.snapshot}
        take={loaded.share.take}
        includeScore={loaded.share.includeScore}
        counts={counts}
        mine={mine}
        viewerAuthed={viewerAuthed}
        viewerOwnsShare={viewerOwnsShare}
        currentPath={`/share/list/${token}`}
      />
    </>
  );
}
