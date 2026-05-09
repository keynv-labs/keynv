import { type NextRequest, NextResponse } from 'next/server';

/**
 * Auth middleware. Public paths: '/', '/login', '/_next/*', static
 * assets, '/api/health'. Everything else requires the session cookie.
 *
 * The cookie's actual validity (signature, expiry) is checked by the
 * keynv-server on every API call; the middleware only gates whether
 * to render the page at all.
 */
const PUBLIC_PATHS = new Set(['/login', '/']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get('keynv_session')?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
