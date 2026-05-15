import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'keynv_session';
const ONE_WEEK_S = 7 * 24 * 3600;

function getSecret(): string {
  const secret = process.env.KEYNV_WEB_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'KEYNV_WEB_SESSION_SECRET must be set (min 32 chars) in production. ' +
        'Generate one with: openssl rand -base64 48',
    );
  }
  // Dev/build fallback — never use in production.
  return 'dev-session-secret-32chars-minimum-length';
}

function sign(payload: string): string {
  const hmac = createHmac('sha256', getSecret()).update(payload, 'utf8').digest('hex');
  return `${payload}.${hmac}`;
}

function verify(signed: string): string | null {
  const dot = signed.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = signed.slice(0, dot);
  const providedMac = signed.slice(dot + 1);
  const expectedMac = createHmac('sha256', getSecret()).update(payload, 'utf8').digest('hex');
  if (providedMac.length !== expectedMac.length) return null;
  if (!timingSafeEqual(Buffer.from(providedMac, 'hex'), Buffer.from(expectedMac, 'hex')))
    return null;
  return payload;
}

export interface Session {
  user_id: string;
  email: string;
  org_id: string;
  org_role: string;
  /** Every org the user belongs to. Populated on login; refreshed via whoami. */
  org_ids?: string[];
  /** The org the user is currently acting as. Defaults to org_id. */
  active_org_id?: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const payload = verify(raw);
    if (!payload) return null;
    return JSON.parse(payload) as Session;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const jar = await cookies();
  const payload = JSON.stringify(session);
  const signed = sign(payload);
  jar.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_WEEK_S,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
