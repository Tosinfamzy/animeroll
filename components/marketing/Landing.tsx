import { SignInButton, SignUpButton } from '@clerk/nextjs';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/rolodex/StatusBadge';
import type { Status } from '@/lib/db/schema';

interface ExampleCard {
  title: string;
  imageUrl: string;
  year: number;
  episodes: number;
  status: Status;
  score: number;
  take: string;
  genres: string[];
}

const EXAMPLES: ExampleCard[] = [
  {
    title: 'Sousou no Frieren',
    imageUrl: 'https://myanimelist.net/images/anime/1015/138006l.jpg',
    year: 2023,
    episodes: 28,
    status: 'completed',
    score: 10,
    take: 'best fight choreography of the decade. cried twice.',
    genres: ['Adventure', 'Drama', 'Fantasy'],
  },
  {
    title: 'Naruto',
    imageUrl: 'https://myanimelist.net/images/anime/1141/142503l.jpg',
    year: 2002,
    episodes: 220,
    status: 'completed',
    score: 9,
    take: 'watched all 220 episodes; still the GOAT.',
    genres: ['Action', 'Adventure', 'Fantasy'],
  },
];

export function Landing() {
  return (
    <div className="px-6 py-16 max-w-6xl mx-auto w-full flex flex-col gap-20">
      <section className="flex flex-col gap-6 items-center text-center max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
          Track what you watch.
          <br />
          <span className="text-primary">Share it like a Letterboxd card.</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          A personal anime watchlist that produces shareable cards. Drop a
          one-line take, send a friend the link &mdash; they see a real OG
          preview in iMessage, WhatsApp, or Discord, no signup needed to read.
        </p>
        <div className="flex gap-3 mt-2">
          <SignUpButton mode="modal">
            <Button size="lg">Get started</Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </SignInButton>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">
          What a share looks like
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EXAMPLES.map((e) => (
            <ExamplePreview key={e.title} {...e} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6 items-center text-center max-w-2xl mx-auto">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          How it works
        </h2>
        <ol className="flex flex-col gap-4 text-left w-full">
          <Step n={1} title="Track your library">
            Search any anime, add it, set a status &mdash; watching, completed,
            dropped. Score it 1&ndash;10 if you want.
          </Step>
          <Step n={2} title="Generate a share link">
            Pick an anime, write a one-line take, hit Share. You get a public
            URL with an OG card baked in.
          </Step>
          <Step n={3} title="Send it to a friend">
            They see the cover, your score, your take, and react with a tap.
            If they sign up, they can save it to their library in one click.
          </Step>
        </ol>
      </section>
    </div>
  );
}

function ExamplePreview({ title, imageUrl, year, episodes, status, score, take, genres }: ExampleCard) {
  return (
    <article className="grid grid-cols-[140px_1fr] gap-4 p-4 rounded-lg bg-card border border-border/40">
      <div className="relative aspect-2/3 rounded-md overflow-hidden bg-muted">
        <Image src={imageUrl} alt={title} fill sizes="140px" className="object-cover" />
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <h3 className="font-medium text-base leading-tight">{title}</h3>
        <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          <StatusBadge status={status} />
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/30">
            ★ {score}/10
          </span>
          <span>
            {year} · {episodes} eps
          </span>
        </div>
        <blockquote className="border-l-2 border-primary/60 pl-3 italic text-sm leading-relaxed text-foreground/90 mt-1">
          &ldquo;{take}&rdquo;
        </blockquote>
        <div className="flex flex-wrap gap-1 mt-auto">
          {genres.map((g) => (
            <span
              key={g}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {g}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 items-start">
      <span className="shrink-0 w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center mt-0.5 tabular-nums">
        {n}
      </span>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <h3 className="font-medium text-base leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
