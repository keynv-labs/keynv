import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { CSRF_FIELD_NAME, csrfFieldName } from './csrf-field-name';

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.KEYNV_WEB_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('KEYNV_WEB_SESSION_SECRET must be set (min 32 chars) in production.');
  }
  return 'dev-session-secret-32chars-minimum-length';
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload, 'utf8').digest('base64url');
}

export { csrfFieldName };

export function createCsrfToken(now = Date.now()): string {
  const payload = JSON.stringify({
    nonce: randomBytes(18).toString('base64url'),
    exp: now + TOKEN_TTL_MS,
  });
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sign(payload)}`;
}

export function verifyCsrfToken(token: FormDataEntryValue | null, now = Date.now()): boolean {
  if (typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;

  try {
    const payload = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8');
    const provided = token.slice(dot + 1);
    const expected = sign(payload);
    if (provided.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return false;

    const parsed = JSON.parse(payload) as { exp?: unknown; nonce?: unknown };
    return typeof parsed.exp === 'number' && parsed.exp >= now && typeof parsed.nonce === 'string';
  } catch {
    return false;
  }
}

export function requireCsrf(formData: FormData): { error: string } | null {
  if (verifyCsrfToken(formData.get(CSRF_FIELD_NAME))) return null;
  return { error: 'Security check failed. Refresh the page and try again.' };
}

export function requireCsrfToken(token: string | null | undefined): { error: string } | null {
  if (verifyCsrfToken(token ?? null)) return null;
  return { error: 'Security check failed. Refresh the page and try again.' };
}
