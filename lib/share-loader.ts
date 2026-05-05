import 'server-only';

import { eq } from 'drizzle-orm';
import { cache } from 'react';

import { db } from './db';
import { reactions, shares, type ShareRow } from './db/schema';
import { parseSnapshot, type EntrySnapshot, type ListSnapshot } from './shares';

export type LoadedShare =
  | { kind: 'entry'; share: ShareRow; snapshot: EntrySnapshot }
  | { kind: 'list'; share: ShareRow; snapshot: ListSnapshot };

export const loadShareByToken = cache(async (token: string): Promise<LoadedShare | null> => {
  const row = await db.query.shares.findFirst({ where: eq(shares.token, token) });
  if (!row || row.revokedAt) return null;
  if (row.kind === 'entry') {
    return { kind: 'entry', share: row, snapshot: parseSnapshot('entry', row.snapshot) };
  }
  return { kind: 'list', share: row, snapshot: parseSnapshot('list', row.snapshot) };
});

export const loadShareReactionCounts = cache(
  async (token: string): Promise<{ heart: number; eyes: number; nope: number }> => {
    const rows = await db
      .select({ kind: reactions.kind })
      .from(reactions)
      .where(eq(reactions.shareToken, token));
    const counts = { heart: 0, eyes: 0, nope: 0 };
    for (const r of rows) counts[r.kind] += 1;
    return counts;
  },
);

export const loadReactionFor = cache(
  async (
    token: string,
    reactorId: string,
  ): Promise<'heart' | 'eyes' | 'nope' | null> => {
    const row = await db.query.reactions.findFirst({
      where: (r, { and, eq: e }) => and(e(r.shareToken, token), e(r.reactorId, reactorId)),
    });
    return row?.kind ?? null;
  },
);
