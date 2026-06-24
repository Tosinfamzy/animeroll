'use client';

import { useEffect, useRef } from 'react';

/**
 * Fire-and-forget view beacon. The public share pages are ISR-cached, so
 * recording a view in the server render would undercount; instead we record one
 * POST per mount from the client. `keepalive` lets it complete even if the tab
 * closes immediately. Owner views are skipped client-side (and again on the
 * server) so the creator's own opens never inflate the count.
 */
export function RecordShareView({ token, skip = false }: { token: string; skip?: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (skip || fired.current) return;
    fired.current = true;
    void fetch(`/api/shares/${token}/view`, { method: 'POST', keepalive: true }).catch(
      () => undefined,
    );
  }, [token, skip]);
  return null;
}
