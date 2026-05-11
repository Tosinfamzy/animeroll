'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Top-level route-segment error boundary. Catches any uncaught error in the
 * app tree and renders a friendly fallback. Reset re-renders the segment.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error.tsx]', error);
  }, [error]);

  return (
    <div className="px-6 py-16 max-w-xl mx-auto text-center flex flex-col gap-4 items-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        We hit an unexpected error rendering this page. The detail has been logged
        to the server.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70 font-mono">
          ref: {error.digest}
        </p>
      ) : null}
      <div className="flex gap-2 mt-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="ghost" onClick={() => window.location.assign('/')}>
          Back to home
        </Button>
      </div>
    </div>
  );
}
