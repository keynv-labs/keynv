import { ImageResponse } from 'next/og';

/**
 * /apple-icon — 180×180 PNG used by iOS for "Add to Home Screen" and
 * by older Safari versions that don't render SVG favicons. Generated
 * server-side so the brand stays in sync with the in-app Logomark
 * without us shipping a binary asset.
 */

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const BG = '#0b0d11';
const ACCENT = '#ffb74d';
const ACCENT_SOFT_BORDER = '#5a3d18';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `4px solid ${ACCENT_SOFT_BORDER}`,
        borderRadius: 36,
      }}
    >
      <svg viewBox="0 0 32 32" width={120} height={120}>
        <title>keynv</title>
        <path
          d="M9 7 L9 25 M9 17 L17 9 M9 17 L17 25"
          stroke={ACCENT}
          strokeWidth="2.6"
          strokeLinecap="square"
          fill="none"
        />
        <circle cx="22.5" cy="9.5" r="1.5" fill={ACCENT} />
      </svg>
    </div>,
    size,
  );
}
