import 'server-only';

import { and, desc, eq, isNull } from 'drizzle-orm';
import { cache } from 'react';

import { db } from './db';
import { profiles, shares, type ProfileRow } from './db/schema';
import { normalizeHandle } from './profile';
import { parseSnapshot as parseShareSnapshot } from './shares';

export interface PublicShareItem {
  token: string;
  kind: 'entry' | 'list';
  take: string | null;
  path: string;
  createdAt: string;
  preview:
    | { kind: 'entry'; title: string; imageUrl: string }
    | { kind: 'list'; name: string; entryCount: number; covers: string[] };
}

export interface PublicProfile {
  handle: string;
  displayName: string | null;
  bio: string | null;
  shares: PublicShareItem[];
}

function toItem(row: {
  token: string;
  kind: 'entry' | 'list';
  take: string | null;
  snapshot: string;
  createdAt: Date;
}): PublicShareItem {
  const base = {
    token: row.token,
    kind: row.kind,
    take: row.take,
    path: `/share/${row.kind}/${row.token}`,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.kind === 'entry') {
    const snap = parseShareSnapshot('entry', row.snapshot);
    return { ...base, preview: { kind: 'entry', title: snap.title, imageUrl: snap.imageUrl } };
  }
  const snap = parseShareSnapshot('list', row.snapshot);
  return {
    ...base,
    preview: {
      kind: 'list',
      name: snap.name,
      entryCount: snap.entries.length,
      covers: snap.entries.slice(0, 4).map((e) => e.imageUrl),
    },
  };
}

/**
 * Load a public profile by handle plus its non-revoked shares. Returns null for
 * an unknown handle or a profile whose owner has not made it public. Revoked
 * shares are excluded at the query level, so the page can't leak them.
 */
export const loadPublicProfile = cache(
  async (rawHandle: string): Promise<PublicProfile | null> => {
    const handle = normalizeHandle(rawHandle);
    const profile: ProfileRow | undefined = await db.query.profiles.findFirst({
      where: and(eq(profiles.handle, handle), eq(profiles.isPublic, true)),
    });
    if (!profile) return null;

    const rows = await db
      .select({
        token: shares.token,
        kind: shares.kind,
        take: shares.take,
        snapshot: shares.snapshot,
        createdAt: shares.createdAt,
      })
      .from(shares)
      .where(and(eq(shares.createdBy, profile.userId), isNull(shares.revokedAt)))
      .orderBy(desc(shares.createdAt));

    return {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      shares: rows.map(toItem),
    };
  },
);
