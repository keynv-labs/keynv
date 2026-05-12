import { ImageResponse } from 'next/og';

/**
 * /opengraph-image — generated at request time, cached aggressively
 * via the headers Next sets on the route. Hand-crafted so we don't
 * need a screenshot pipeline; the design tracks the live landing
 * page's headline + code chip motif.
 *
 * Renders at 1200×630 (the LinkedIn / Twitter / Facebook canonical
 * preview size). Same image is used for the twitter card; the
 * landing's <metadata.twitter.card> is set to 'summary_large_image'.
 */

export const alt = 'keynv — secrets your AI agent can’t leak';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0a0c0f';
const BG_ELEVATED = '#13161b';
const BORDER = '#23272f';
const BORDER_STRONG = '#2f343d';
const FG = '#e9ecf2';
const FG_MUTED = '#9098a4';
const FG_SUBTLE = '#5d6470';
const ACCENT = '#5b8def';
const SUCCESS = '#3ec98a';

async function loadInter(weight: 400 | 500 | 600) {
  const url = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`;
  const css = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const match = css.match(/src: url\((.+?)\) format/);
  if (!match) throw new Error(`Could not find Inter weight ${weight} font URL`);
  const fontUrl = match[1] as string;
  const buffer = await fetch(fontUrl).then((r) => r.arrayBuffer());
  return buffer;
}

export default async function OpengraphImage() {
  const [interRegular, interMedium, interSemibold] = await Promise.all([
    loadInter(400),
    loadInter(500),
    loadInter(600),
  ]);

  return new ImageResponse(
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        color: FG,
        fontFamily: 'Inter',
        padding: '64px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(to right, ${BORDER} 1px, transparent 1px), linear-gradient(to bottom, ${BORDER} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          opacity: 0.35,
          maskImage:
            'radial-gradient(ellipse 70% 60% at 35% 50%, rgba(0,0,0,0.9), transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 35% 50%, rgba(0,0,0,0.9), transparent 75%)',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: ACCENT,
              color: '#ffffff',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 26,
              lineHeight: 1,
            }}
          >
            k
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>keynv</div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${BORDER_STRONG}`,
            borderRadius: 999,
            padding: '8px 14px',
            background: BG_ELEVATED,
            color: FG_MUTED,
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: SUCCESS,
            }}
          />
          Phases 1–3 shipping
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 88,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.02,
            maxWidth: 980,
          }}
        >
          <span>Secrets your AI agent</span>
          <span style={{ color: FG_MUTED }}>can&rsquo;t leak.</span>
        </div>

        <div
          style={{
            marginTop: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            border: `1px solid ${BORDER}`,
            background: BG_ELEVATED,
            borderRadius: 12,
            padding: '18px 22px',
            maxWidth: 920,
            fontFamily: 'monospace',
            fontSize: 26,
            letterSpacing: '-0.005em',
          }}
        >
          <span style={{ color: FG_SUBTLE }}>$</span>
          <span style={{ color: FG }}>keynv exec -- mysql -p</span>
          <span style={{ color: ACCENT }}>@billing.prod.db_password</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          zIndex: 1,
          color: FG_MUTED,
          fontSize: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: FG_SUBTLE,
            }}
          />
          Self-hosted · AI-safe by design
        </div>
        <div style={{ color: FG, fontWeight: 500 }}>keynv.dev</div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interMedium, weight: 500, style: 'normal' },
        { name: 'Inter', data: interSemibold, weight: 600, style: 'normal' },
      ],
    },
  );
}
