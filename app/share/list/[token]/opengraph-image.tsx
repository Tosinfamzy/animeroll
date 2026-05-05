import { ImageResponse } from 'next/og';

import { loadShareByToken } from '@/lib/share-loader';
import { OG_ACCENT, OG_BG, OG_CONTENT_TYPE, OG_FG, OG_MUTED, OG_SIZE } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Anime Rolodex shared list';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function OG({ params }: Props) {
  const { token } = await params;
  const loaded = await loadShareByToken(token);

  if (!loaded || loaded.kind !== 'list') {
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
  const covers = snapshot.entries.slice(0, 5).map((e) => e.imageUrl).filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: OG_BG,
          color: OG_FG,
          padding: 60,
        }}
      >
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
          {`Anime Rolodex · A list of ${snapshot.entries.length} ${snapshot.entries.length === 1 ? 'pick' : 'picks'}`}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.05,
            marginBottom: 16,
            display: 'flex',
          }}
        >
          {snapshot.name}
        </div>
        {take ? (
          <div
            style={{
              fontSize: 30,
              fontStyle: 'italic',
              color: OG_FG,
              borderLeft: `4px solid ${OG_ACCENT}`,
              paddingLeft: 20,
              lineHeight: 1.3,
              marginBottom: 32,
              display: 'flex',
            }}
          >
            {`"${take}"`}
          </div>
        ) : snapshot.description ? (
          <div style={{ fontSize: 28, color: OG_MUTED, marginBottom: 32, display: 'flex' }}>
            {snapshot.description}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 16, marginTop: 'auto' }}>
          {covers.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              width={180}
              height={270}
              style={{ borderRadius: 12, objectFit: 'cover' }}
              alt=""
            />
          ))}
          {covers.length === 0 ? (
            <div style={{ fontSize: 24, color: OG_MUTED, display: 'flex' }}>
              Empty list
            </div>
          ) : null}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
