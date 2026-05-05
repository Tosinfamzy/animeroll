import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function SignupCTA() {
  return (
    <div className="border border-border/60 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/30">
      <div>
        <p className="font-medium">Track your own watchlist</p>
        <p className="text-sm text-muted-foreground">
          Anime Rolodex is a personal watchlist that produces shareable cards like this one.
        </p>
      </div>
      <Link
        href="/"
        className={
          'inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90 transition-colors'
        }
      >
        Start your library
      </Link>
    </div>
  );
}
