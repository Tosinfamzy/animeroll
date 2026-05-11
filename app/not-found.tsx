import Link from 'next/link';

/**
 * Default 404 page. Used when:
 *  - A route segment calls `notFound()`
 *  - Clerk's `auth.protect()` rewrites an unauthed request to /_not-found
 *  - User hits a path that doesn't exist
 */
export default function NotFound() {
  return (
    <div className="px-6 py-16 max-w-xl mx-auto text-center flex flex-col gap-4 items-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you&rsquo;re looking for doesn&rsquo;t exist, has moved, or
        you might need to sign in to see it.
      </p>
      <div className="flex gap-2 mt-2">
        <Link
          href="/"
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Back to home
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
