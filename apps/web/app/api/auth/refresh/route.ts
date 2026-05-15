import { COOKIE_NAME, decodeSession, encodeSession, sessionCookieOptions } from '@/lib/session';
import { type NextRequest, NextResponse } from 'next/server';

const BLOCKED_HOSTS = [
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'localhost',
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.internal',
];

function isSafeServerUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) return false;
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return req.nextUrl.origin;
}

function redirectTo(origin: string, path: string, withNext?: string): NextResponse {
  const url = new URL(path, origin);
  if (withNext) url.searchParams.set('next', withNext);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  const referrer = req.headers.get('referer') || '';
  let next = req.nextUrl.searchParams.get('next') || '';
  if (!next) {
    try {
      const refUrl = new URL(referrer);
      next = refUrl.pathname + refUrl.search;
    } catch {
      next = '/dashboard';
    }
  }
  if (!next.startsWith('/')) next = '/dashboard';

  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return redirectTo(origin, '/login', next);

  const session = decodeSession(raw);
  if (!session) return redirectTo(origin, '/login', next);

  if (!session.refresh_token) return redirectTo(origin, '/login', next);

  const serverUrl = process.env.KEYNV_SERVER_URL;
  if (!serverUrl || !isSafeServerUrl(serverUrl)) return redirectTo(origin, '/login');

  try {
    const res = await fetch(new URL('/v1/auth/refresh', serverUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) return redirectTo(origin, '/login', next);

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const updated = {
      ...session,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };

    const response = redirectTo(origin, next);
    response.cookies.set(COOKIE_NAME, encodeSession(updated), sessionCookieOptions());

    return response;
  } catch {
    return redirectTo(origin, '/login', next);
  }
}
