import { type NextRequest, NextResponse } from 'next/server';
import { isHostedInstance } from './lib/hosted';

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

// Marketing / SEO surface that a self-hoster's panel doesn't need. Served
// only on the hosted keynv Cloud (KEYNV_HOSTED=true); 404'd otherwise.
const HOSTED_ONLY_PREFIXES = ['/changelog', '/llms.txt'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    !isHostedInstance() &&
    HOSTED_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    STATIC_OR_DISCOVERY.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Protected route. The middleware stays passive — it never redirects, to
  // avoid redirect loops under Next.js standalone output; the actual auth
  // gate lives in the server layouts/pages. We surface the requested
  // path+query here so those gates can redirect to /login?next=… and return
  // the user to their deep link after login.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-keynv-pathname', `${pathname}${req.nextUrl.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
