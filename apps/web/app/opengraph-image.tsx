import { ImageResponse } from 'next/og';

/**
 * /opengraph-image — Redacted Dossier identity.
 *
 * 1200×630, matched to the newsprint landing. Hand-crafted: massive
 * Fraunces-substitute (we ship Newsreader weights via Google because
 * Fraunces variable axes don't all load through next/og's fetch
 * path; Newsreader provides the same editorial register at this
 * scale).
 *
 * Layout reads top-down as a magazine cover: masthead → headline
 * with a redaction bar drawn directly over "can't" → strapline →
 * footer stamp + alias chip. Same image is served for Twitter.
 */

export const alt = 'keynv — secrets your AI agent can’t see';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#f2efe7';
const INK = '#0e0e0e';
const INK_SOFT = '#3f3a30';
const INK_SUBTLE = '#76705f';
const HIGHLIGHT = '#f4d85e';
const BORDER = '#9a907a';

async function loadFont(
  family: string,
  weight: number,
  italic = false,
): Promise<ArrayBuffer> {
  const italicSegment = italic ? 'ital,wght@1,' : 'wght@';
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${italicSegment}${weight}&display=swap`;
  const css = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) =>
    r.text(),
  );
  const match = css.match(/src: url\((.+?)\) format/);
  if (!match) throw new Error(`Could not resolve ${family} ${weight}`);
  return fetch(match[1] as string).then((r) => r.arrayBuffer());
}

export default async function OpengraphImage() {
  const [headlineFont, bodyFont, bodyItalic, monoFont] = await Promise.all([
    loadFont('Newsreader', 500),
    loadFont('Newsreader', 400),
    loadFont('Newsreader', 400, true),
    loadFont('JetBrains Mono', 500),
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
        color: INK,
        fontFamily: 'Newsreader',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 56px',
          borderBottom: `1px solid ${BORDER}`,
          fontFamily: 'JetBrains Mono',
          fontSize: 14,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: INK_SOFT,
        }}
      >
        <span style={{ display: 'flex' }}>VOL. I · NO. 0001</span>
        <span style={{ display: 'flex' }}>SELF-HOSTED · AI-SAFE BY DESIGN</span>
        <span style={{ display: 'flex' }}>keynv.dev</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 56px 28px',
          borderBottom: `2px solid ${INK}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: INK,
              color: BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Newsreader',
              fontWeight: 500,
              fontSize: 48,
              lineHeight: 1,
              boxShadow: `6px 6px 0 0 ${HIGHLIGHT}`,
            }}
          >
            k
          </div>
          <div
            style={{
              fontFamily: 'Newsreader',
              fontWeight: 500,
              fontSize: 76,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              display: 'flex',
            }}
          >
            keynv
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'JetBrains Mono',
            fontSize: 13,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: INK_SOFT,
          }}
        >
          FILED · CASE 0001
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 56px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Newsreader',
            fontWeight: 500,
            fontSize: 132,
            lineHeight: 0.95,
            letterSpacing: '-0.025em',
            color: INK,
          }}
        >
          <span style={{ display: 'flex' }}>Secrets your AI</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            agent
            <span
              style={{
                display: 'flex',
                background: INK,
                color: 'transparent',
                padding: '0 16px',
                lineHeight: 0.95,
                transform: 'translateY(-6px)',
              }}
            >
              can&apos;t
            </span>
            see.
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 56px',
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Newsreader',
            fontStyle: 'italic',
            fontSize: 22,
            color: INK_SOFT,
            maxWidth: 700,
          }}
        >
          Self-hosted vault for API keys, DB passwords, SSH credentials. Reference everything by
          alias — the only string an agent ever observes.
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'JetBrains Mono',
            fontSize: 17,
            color: INK,
            border: `1px solid ${BORDER}`,
            background: BG,
            padding: '8px 14px',
          }}
        >
          <span style={{ display: 'flex', color: INK_SUBTLE }}>$</span>
          <span style={{ display: 'flex' }}>keynv exec --</span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Newsreader', data: headlineFont, weight: 500, style: 'normal' },
        { name: 'Newsreader', data: bodyFont, weight: 400, style: 'normal' },
        { name: 'Newsreader', data: bodyItalic, weight: 400, style: 'italic' },
        { name: 'JetBrains Mono', data: monoFont, weight: 500, style: 'normal' },
      ],
    },
  );
}
