/**
 * Server-side fetch wrapper that talks to keynv-server. Used by
 * Server Components and Server Actions only; the browser never sees
 * the access token directly.
 */
import { redirect } from 'next/navigation';
import { env } from './env';
import { type Session, getSession } from './session';

const AGENT = 'keynv-web/0.0.0';

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

function apiError(
  status: number,
  code: string | undefined,
  message: string,
  details?: unknown,
): ApiError {
  const e = new Error(message) as ApiError;
  e.status = status;
  if (code !== undefined) e.code = code;
  if (details !== undefined) e.details = details;
  return e;
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Set false to skip the auth header; defaults to true. */
  authed?: boolean;
  /** Override the session (e.g., right after login before cookie persists). */
  session?: Session;
  /** Forwarded as X-Keynv-Agent for audit attribution. */
  agentSuffix?: string;
}

function buildUrl(path: string, query?: RequestOpts['query']): string {
  const url = new URL(path, env.KEYNV_SERVER_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function api<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const session = opts.session ?? (opts.authed === false ? null : await getSession());
  if (opts.authed !== false && !session) {
    throw apiError(401, 'auth.missing_token', 'Not logged in.');
  }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-keynv-agent': opts.agentSuffix ? `${AGENT} ${opts.agentSuffix}` : AGENT,
  };
  if (session) headers.authorization = `Bearer ${session.access_token}`;

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    cache: 'no-store',
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const errPayload = (
      parsed as { error?: { code?: string; message?: string; details?: unknown } }
    )?.error;

    // If we presented a session token and the server rejected it, the
    // session is dead (expired access token, JWT secret rotated on a
    // server restart, refresh token revoked, password changed). Bounce
    // to /login; the loginAction's setSession will overwrite the stale
    // cookie. We can't call clearSession from here — Next.js forbids
    // modifying cookies in a Server Component context, and api() is
    // most often invoked from one.
    //
    // Login + refresh flows pass authed: false, so they never hit this
    // branch — wrong-password errors still surface to the form.
    if (
      res.status === 401 &&
      session &&
      typeof errPayload?.code === 'string' &&
      errPayload.code.startsWith('auth.')
    ) {
      redirect('/login');
    }

    throw apiError(
      res.status,
      errPayload?.code,
      errPayload?.message ?? `Request failed (${res.status})`,
      errPayload?.details,
    );
  }
  return parsed as T;
}
