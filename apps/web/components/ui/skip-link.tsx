/**
 * Accessibility helper. Renders a "Skip to content" link that is
 * visually hidden until it receives keyboard focus, then becomes a
 * prominent top-left chip. Pairs with a `<main id="main">` landmark
 * elsewhere on the page so keyboard + screen-reader users can bypass
 * the nav chrome.
 *
 * Mount as the FIRST child of <body> (or of the page wrapper) so the
 * Tab key reaches it before anything else.
 */
export function SkipLink({ targetId = 'main' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.style.position = 'fixed';
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.margin = '0';
        el.style.overflow = 'visible';
        el.style.clip = 'auto';
        el.style.top = '12px';
        el.style.left = '12px';
        el.style.zIndex = '50';
        el.style.borderRadius = '6px';
        el.style.border = '1px solid var(--color-accent)';
        el.style.background = 'var(--color-bg-elevated)';
        el.style.padding = '8px 12px';
        el.style.fontSize = '14px';
        el.style.color = 'var(--color-fg)';
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        el.style.position = 'absolute';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.padding = '0';
        el.style.margin = '-1px';
        el.style.overflow = 'hidden';
        el.style.clip = 'rect(0,0,0,0)';
        el.style.whiteSpace = 'nowrap';
        el.style.border = '0';
      }}
    >
      Skip to content
    </a>
  );
}
