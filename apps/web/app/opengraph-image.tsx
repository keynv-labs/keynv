import { ImageResponse } from 'next/og';

/**
 * /opengraph-image — generated at request time, cached aggressively
 * via the headers Next sets on the route. Hand-crafted so we don't
 * need a screenshot pipeline; the design tracks the live landing
 * page's amber identity + alias chip motif.
 *
 * Renders at 1200×630 (the LinkedIn / Twitter / Facebook canonical
 * preview size). Same image is used for the twitter card; the
 * landing's <metadata.twitter.card> is set to 'summary_large_image'.
 */

export const alt = 'keynv — developer-first secrets management';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0b0d11';
const BG_ELEVATED = '#14171d';
const BG_INSET = '#07090c';
const BORDER = '#23262e';
const BORDER_STRONG = '#313640';
const FG = '#e9ecf2';
const FG_MUTED = '#9098a4';
const FG_SUBTLE = '#7a8593';
const ACCENT = '#ffb74d';
const ACCENT_SOFT = '#2a1d0a';
const ACCENT_SOFT_BORDER = '#5a3d18';
const SUCCESS = '#5dd9a8';

// Inter / JetBrains Mono are used here (not the in-app Geist family)
// because @vercel/og's font parser does not yet support some of Geist's
// OpenType features — the build hits
//   `lookupType: 6 - substFormat: 1 is not yet supported`
// during static prerender of /opengraph-image. The visual identity
// (amber accent, alias chip, layout) is what carries the brand on
// social previews; the typeface is a secondary signal.
async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`;
  const css = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const match = css.match(/src: url\((.+?)\) format/);
  if (!match) throw new Error(`Could not find ${family} weight ${weight} font URL`);
  const fontUrl = match[1] as string;
  return fetch(fontUrl).then((r) => r.arrayBuffer());
}

export default async function OpengraphImage() {
  const [interRegular, interMedium, interSemibold, jbMono, jbMonoMedium] = await Promise.all([
    loadGoogleFont('Inter', 400),
    loadGoogleFont('Inter', 500),
    loadGoogleFont('Inter', 600),
    loadGoogleFont('JetBrains+Mono', 400),
    loadGoogleFont('JetBrains+Mono', 500),
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
      {/* micro-grid backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(to right, ${BORDER} 1px, transparent 1px), linear-gradient(to bottom, ${BORDER} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          opacity: 0.4,
          maskImage:
            'radial-gradient(ellipse 70% 60% at 30% 50%, rgba(0,0,0,0.9), transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 30% 50%, rgba(0,0,0,0.9), transparent 75%)',
        }}
      />

      {/* amber halo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 50% 40% at 75% 50%, ${ACCENT}33, transparent 70%)`,
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
              position: 'relative',
              width: 48,
              height: 48,
              background: BG_INSET,
              border: `1px solid ${ACCENT_SOFT_BORDER}`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 32 32" width={32} height={32}>
              <title>keynv glyph</title>
              <path
                d="M9 7 L9 25 M9 17 L17 9 M9 17 L17 25"
                stroke={ACCENT}
                strokeWidth="2.6"
                strokeLinecap="square"
                fill="none"
              />
              <circle cx="22.5" cy="9.5" r="1.5" fill={ACCENT} />
            </svg>
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em' }}>keynv</div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: `1px solid ${ACCENT_SOFT_BORDER}`,
            borderRadius: 999,
            padding: '8px 16px',
            background: ACCENT_SOFT,
            color: ACCENT,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'JetBrains Mono',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
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
          public beta
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
            fontSize: 92,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.02,
            maxWidth: 980,
          }}
        >
          <span>Store secrets once.</span>
          <span style={{ color: FG_MUTED }}>Use safe aliases everywhere.</span>
        </div>

        <div
          style={{
            marginTop: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            border: `1px solid ${BORDER_STRONG}`,
            background: BG_ELEVATED,
            borderRadius: 14,
            padding: '20px 24px',
            maxWidth: 920,
            fontFamily: 'JetBrains Mono',
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
          fontSize: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'JetBrains Mono',
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            fontSize: 14,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 999, background: ACCENT }} />
          self-hosted · ai-safe by design
        </div>
        <div style={{ color: FG, fontWeight: 500, fontSize: 22 }}>keynv.dev</div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interMedium, weight: 500, style: 'normal' },
        { name: 'Inter', data: interSemibold, weight: 600, style: 'normal' },
        { name: 'JetBrains Mono', data: jbMono, weight: 400, style: 'normal' },
        { name: 'JetBrains Mono', data: jbMonoMedium, weight: 500, style: 'normal' },
      ],
    },
  );
}
