import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';

import { PublicListView } from '@/components/share/PublicListView';
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
  if (!loaded || loaded.kind !== 'list') {
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
  if (!loaded || loaded.kind !== 'list') notFound();

  const counts = await loadShareReactionCounts(token);
  const cookieStore = await cookies();
  const reactorId = cookieStore.get(REACTOR_COOKIE)?.value;
  const mine = reactorId ? await loadReactionFor(token, reactorId) : null;

  return (
    <PublicListView
      token={token}
      snapshot={loaded.snapshot}
      take={loaded.share.take}
      counts={counts}
      mine={mine}
    />
  );
}
