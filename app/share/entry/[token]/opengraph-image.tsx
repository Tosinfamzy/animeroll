import { ImageResponse } from 'next/og';

import { loadShareByToken } from '@/lib/share-loader';
import { OG_ACCENT, OG_BG, OG_CONTENT_TYPE, OG_FG, OG_MUTED, OG_SIZE } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Anime Rolodex share';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function OG({ params }: Props) {
  const { token } = await params;
  const loaded = await loadShareByToken(token);

  if (loaded?.kind !== 'entry') {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: OG_BG,
            color: OG_FG,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
          }}
        >
          Share not found
        </div>
      ),
      OG_SIZE,
    );
  }

  const { snapshot } = loaded;
  const take = loaded.share.take;
  const showScore = loaded.share.includeScore && snapshot.userScore !== null;
  const meta = [
    snapshot.year ? String(snapshot.year) : null,
    snapshot.episodes ? `${snapshot.episodes} eps` : null,
    snapshot.genres.slice(0, 2).join(' · ') || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: OG_BG,
          color: OG_FG,
          padding: 60,
        }}
      >
        {snapshot.imageUrl ? (
          <img
            src={snapshot.imageUrl}
            width={340}
            height={510}
            style={{ borderRadius: 16, marginRight: 48, objectFit: 'cover' }}
            alt=""
          />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: OG_MUTED,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 16,
            }}
          >
            Anime Rolodex
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.05,
              marginBottom: 18,
              display: 'flex',
            }}
          >
            {snapshot.title}
          </div>
          {meta ? (
            <div style={{ fontSize: 24, color: OG_MUTED, marginBottom: 28, display: 'flex' }}>
              {meta}
            </div>
          ) : null}
          {take ? (
            <div
              style={{
                fontSize: 32,
                fontStyle: 'italic',
                color: OG_FG,
                borderLeft: `4px solid ${OG_ACCENT}`,
                paddingLeft: 20,
                lineHeight: 1.3,
                marginBottom: 24,
                display: 'flex',
              }}
            >
              {`"${take}"`}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              fontSize: 28,
            }}
          >
            {showScore ? (
              <span
                style={{
                  background: OG_ACCENT,
                  color: '#0a0a0a',
                  padding: '8px 18px',
                  borderRadius: 999,
                  fontWeight: 700,
                  display: 'flex',
                }}
              >
                {`MY SCORE ${String(snapshot.userScore)}/10`}
              </span>
            ) : null}
            <span style={{ color: OG_MUTED, display: 'flex' }}>shared a take</span>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
