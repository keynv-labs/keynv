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
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-accent focus:bg-bg-elevated focus:px-3 focus:py-2 focus:text-sm focus:text-fg focus:shadow-[0_0_0_3px_rgba(255,183,77,0.3)]"
    >
      Skip to content
    </a>
  );
}
