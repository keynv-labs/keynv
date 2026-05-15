import { type NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'keynv_session';

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

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
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

  function redirectTo(path: string, withNext?: string) {
    const url = new URL(path, origin);
    if (withNext) url.searchParams.set('next', withNext);
    return NextResponse.redirect(url);
  }

  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return redirectTo('/login', next);

  let session: {
    server_url?: string;
    refresh_token?: string;
    access_token?: string;
    access_expires_at?: string;
  };
  try {
    session = JSON.parse(raw);
  } catch {
    return redirectTo('/login');
  }

  if (!session.refresh_token) return redirectTo('/login', next);

  const serverUrl = session.server_url || process.env.KEYNV_SERVER_URL;
  if (!serverUrl || !isSafeServerUrl(serverUrl)) return redirectTo('/login');

  try {
    const res = await fetch(new URL('/v1/auth/refresh', serverUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) return redirectTo('/login', next);

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

    const response = redirectTo(next);
    response.cookies.set(COOKIE_NAME, JSON.stringify(updated), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch {
    return redirectTo('/login', next);
  }
}
