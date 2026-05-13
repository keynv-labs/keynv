/**
 * Session-cookie helpers. The session payload is the same shape the
 * keynv-server returns from POST /v1/auth/login, JSON-serialized into
 * a single httpOnly Secure cookie. We do NOT add a separate HMAC over
 * the cookie value because the contained access_token is already a
 * signed JWT — tampering breaks signature verification on the next
 * server call.
 *
 * The cookie is httpOnly + SameSite=Lax + Secure-when-HTTPS so client
 * JavaScript cannot exfiltrate it.
 */
import { cookies } from 'next/headers';

const COOKIE_NAME = 'keynv_session';
const ONE_WEEK_S = 7 * 24 * 3600;

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
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, JSON.stringify(session), {
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
