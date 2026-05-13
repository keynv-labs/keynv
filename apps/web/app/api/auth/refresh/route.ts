import { type NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'keynv_session';

export async function GET(req: NextRequest) {
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
  if (!raw) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }

  let session: {
    server_url?: string;
    refresh_token?: string;
    access_token?: string;
    access_expires_at?: string;
  };
  try {
    session = JSON.parse(raw);
  } catch {
    const login = new URL('/login', req.url);
    return NextResponse.redirect(login);
  }

  if (!session.refresh_token) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }

  const serverUrl = session.server_url || process.env.KEYNV_SERVER_URL;
  if (!serverUrl) {
    const login = new URL('/login', req.url);
    return NextResponse.redirect(login);
  }

  try {
    const res = await fetch(new URL('/v1/auth/refresh', serverUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) {
      const login = new URL('/login', req.url);
      login.searchParams.set('next', next);
      return NextResponse.redirect(login);
    }

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

    const response = NextResponse.redirect(new URL(next, req.url));
    response.cookies.set(COOKIE_NAME, JSON.stringify(updated), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }
}
