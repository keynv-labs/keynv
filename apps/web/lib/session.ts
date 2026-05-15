import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE_NAME = 'keynv_session';
export const ONE_WEEK_S = 7 * 24 * 3600;
const SEALED_PREFIX = 'v2';

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

function encryptionKey(): Buffer {
  return createHash('sha256').update(getSecret(), 'utf8').digest();
}

function toBase64Url(input: Buffer): string {
  return input.toString('base64url');
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function seal(payload: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [SEALED_PREFIX, toBase64Url(iv), toBase64Url(ciphertext), toBase64Url(tag)].join('.');
}

function unseal(sealed: string): string | null {
  const [version, ivRaw, ciphertextRaw, tagRaw, extra] = sealed.split('.');
  if (version !== SEALED_PREFIX || extra !== undefined || !ivRaw || !ciphertextRaw || !tagRaw) {
    return null;
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), fromBase64Url(ivRaw));
    decipher.setAuthTag(fromBase64Url(tagRaw));
    return Buffer.concat([
      decipher.update(fromBase64Url(ciphertextRaw)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
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

export function encodeSession(session: Session): string {
  return seal(JSON.stringify(session));
}

export function decodeSession(raw: string): Session | null {
  try {
    const payload = raw.startsWith(`${SEALED_PREFIX}.`) ? unseal(raw) : verify(raw);
    if (!payload) return null;
    return JSON.parse(payload) as Session;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_WEEK_S,
  };
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
  return decodeSession(raw);
}

export async function setSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeSession(session), sessionCookieOptions());
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
