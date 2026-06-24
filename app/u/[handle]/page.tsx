import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

import { Card } from '@/components/ui/card';
import { loadPublicProfile, type PublicShareItem } from '@/lib/profile-loader';

interface Props {
  params: Promise<{ handle: string }>;
}

export const revalidate = 60;

function displayFor(p: { displayName: string | null; handle: string }): string {
  return p.displayName ?? `@${p.handle}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadPublicProfile(handle);
  if (!profile) return { title: 'Profile not found · Animeroll' };
  const name = displayFor(profile);
  const description =
    profile.bio ?? `${name}'s shared anime on Animeroll — ${profile.shares.length.toString()} picks.`;
  return {
    title: `${name} · Animeroll`,
    description,
    openGraph: { title: name, description, type: 'profile' },
    twitter: { card: 'summary', title: name, description },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  const profile = await loadPublicProfile(handle);
  if (!profile) notFound();

  const name = displayFor(profile);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">@{profile.handle}</p>
        {profile.bio ? <p className="text-sm mt-3 max-w-prose">{profile.bio}</p> : null}
      </header>

      {profile.shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">No public shares yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profile.shares.map((s) => (
            <ShareCard key={s.token} item={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShareCard({ item }: { item: PublicShareItem }) {
  return (
    <Link href={item.path} className="group">
      <Card className="p-4 flex gap-4 items-start h-full transition-colors group-hover:border-primary/50">
        <div className="shrink-0">
          {item.preview.kind === 'entry' ? (
            <div className="relative aspect-2/3 w-16 rounded-md overflow-hidden bg-muted">
              {item.preview.imageUrl ? (
                <Image
                  src={item.preview.imageUrl}
                  alt={item.preview.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-0.5 w-16">
              {item.preview.covers.slice(0, 4).map((src, i) => (
                <div key={i} className="relative aspect-square rounded overflow-hidden bg-muted">
                  {src ? <Image src={src} alt="" fill sizes="32px" className="object-cover" /> : null}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <h3 className="text-sm font-medium leading-tight line-clamp-2">
            {item.preview.kind === 'entry' ? item.preview.title : item.preview.name}
          </h3>
          {item.preview.kind === 'list' ? (
            <span className="text-xs text-muted-foreground">
              {item.preview.entryCount} {item.preview.entryCount === 1 ? 'entry' : 'entries'}
            </span>
          ) : null}
          {item.take ? (
            <p className="text-xs italic text-foreground/80 line-clamp-2">&ldquo;{item.take}&rdquo;</p>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
