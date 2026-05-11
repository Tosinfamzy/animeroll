import Link from 'next/link';

/**
 * Surfaced when /share/list/[token]/page.tsx calls notFound() — token
 * missing, revoked, or refers to an entry-share (wrong kind).
 */
export default function ShareListNotFound() {
  return (
    <div className="px-6 py-16 max-w-xl mx-auto text-center flex flex-col gap-4 items-center">
      <h1 className="text-2xl font-semibold tracking-tight">List share unavailable</h1>
      <p className="text-sm text-muted-foreground">
        This list share link has been revoked, never existed, or refers to a
        single entry instead of a list. The creator may have generated a new
        one.
      </p>
      <div className="flex gap-2 mt-2">
        <Link
          href="/"
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Visit Animeroll
        </Link>
      </div>
    </div>
  );
}
