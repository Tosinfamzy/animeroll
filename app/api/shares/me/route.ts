import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { reactions, shares } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth';
import { parseSnapshot, shareUrl } from '@/lib/shares';

interface MyShareRow {
  token: string;
  kind: 'entry' | 'list';
  take: string | null;
  includeScore: boolean;
  createdAt: string;
  revokedAt: string | null;
  url: string;
  counts: { heart: number; eyes: number; nope: number };
  preview:
    | { kind: 'entry'; title: string; imageUrl: string; userScore: number | null }
    | { kind: 'list'; name: string; entryCount: number; covers: string[] };
}

export async function GET() {
  const userId = await requireUserId();

  const rows = await db
    .select({
      share: shares,
      heartCount: sql<number>`COUNT(CASE WHEN ${reactions.kind} = 'heart' THEN 1 END)`.as(
        'heart_count',
      ),
      eyesCount: sql<number>`COUNT(CASE WHEN ${reactions.kind} = 'eyes' THEN 1 END)`.as(
        'eyes_count',
      ),
      nopeCount: sql<number>`COUNT(CASE WHEN ${reactions.kind} = 'nope' THEN 1 END)`.as(
        'nope_count',
      ),
    })
    .from(shares)
    .leftJoin(reactions, eq(reactions.shareToken, shares.token))
    .where(eq(shares.createdBy, userId))
    .groupBy(shares.token)
    .orderBy(desc(shares.createdAt));

  const data: MyShareRow[] = rows.map((r) => {
    const base = {
      token: r.share.token,
      kind: r.share.kind,
      take: r.share.take,
      includeScore: r.share.includeScore,
      createdAt: r.share.createdAt.toISOString(),
      revokedAt: r.share.revokedAt?.toISOString() ?? null,
      url: shareUrl(r.share.token, r.share.kind),
      counts: {
        heart: r.heartCount,
        eyes: r.eyesCount,
        nope: r.nopeCount,
      },
    };
    if (r.share.kind === 'entry') {
      const snap = parseSnapshot('entry', r.share.snapshot);
      return {
        ...base,
        kind: 'entry' as const,
        preview: {
          kind: 'entry' as const,
          title: snap.title,
          imageUrl: snap.imageUrl,
          userScore: snap.userScore,
        },
      };
    }
    const snap = parseSnapshot('list', r.share.snapshot);
    return {
      ...base,
      kind: 'list' as const,
      preview: {
        kind: 'list' as const,
        name: snap.name,
        entryCount: snap.entries.length,
        covers: snap.entries.slice(0, 4).map((e) => e.imageUrl),
      },
    };
  });

  return NextResponse.json({ data });
}

export type { MyShareRow };
