import { type NextRequest, NextResponse } from 'next/server';

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return req.nextUrl.origin;
}

/**
 * Auth middleware. Public:
 *   - The landing pages: '/', '/login', '/register'
 *   - The public marketing surface: '/docs/*', '/changelog/*',
 *     '/opengraph-image', '/twitter-image' (Next.js' file-based image
 *     routes serve without an extension on the wire)
 *   - Internal infra: '/_next/*', '/api/health'
 *   - Any path with a file extension (favicons, robots.txt,
 *     sitemap.xml, llms.txt, …)
 *
 * Everything else requires the session cookie. The cookie's actual
 * validity (signature, expiry) is checked by the keynv-server on
 * every API call; the middleware only gates whether to render the
 * page at all.
 *
 * `/register` itself decides whether to render the form or bounce to
 * /login based on the server's `capabilities.public_registration`
 * flag — middleware just lets the request through.
 */
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/changelog',
  '/docs',
  '/opengraph-image',
  '/twitter-image',
]);
const PUBLIC_PREFIXES = ['/docs/', '/changelog/'];
const STATIC_OR_DISCOVERY = /\.[a-zA-Z0-9]+$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    STATIC_OR_DISCOVERY.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get('keynv_session')?.value;
  if (!session) {
    const origin = getOrigin(req);
    const url = new URL('/login', origin);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
