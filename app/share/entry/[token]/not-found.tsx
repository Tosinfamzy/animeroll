import Link from 'next/link';

/**
 * Surfaced when /share/entry/[token]/page.tsx calls notFound() — i.e. the
 * token doesn't exist, was revoked, or refers to a list-share (wrong kind).
 */
export default function ShareEntryNotFound() {
  return (
    <div className="px-6 py-16 max-w-xl mx-auto text-center flex flex-col gap-4 items-center">
      <h1 className="text-2xl font-semibold tracking-tight">Share unavailable</h1>
      <p className="text-sm text-muted-foreground">
        This share link has been revoked, never existed, or refers to a list
        instead of an entry. The creator may have generated a new one.
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
