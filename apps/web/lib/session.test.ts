import { describe, expect, it } from 'vitest';
import { type Session, decodeSession, encodeSession } from './session';

const SESSION: Session = {
  user_id: 'user_123',
  email: 'alice@example.com',
  org_id: 'org_123',
  org_role: 'owner',
  org_ids: ['org_123'],
  active_org_id: 'org_123',
  access_token: 'access-token-secret',
  refresh_token: 'refresh-token-secret',
  access_expires_at: '2030-01-01T00:00:00.000Z',
};

describe('session sealing', () => {
  it('round-trips sealed session cookies', () => {
    const encoded = encodeSession(SESSION);

    expect(encoded).toMatch(/^v2\./);
    expect(decodeSession(encoded)).toEqual(SESSION);
  });

  it('does not store sensitive session fields as plaintext', () => {
    const encoded = encodeSession(SESSION);

    expect(encoded).not.toContain(SESSION.email);
    expect(encoded).not.toContain(SESSION.access_token);
    expect(encoded).not.toContain(SESSION.refresh_token);
  });

  it('rejects tampered sealed cookies', () => {
    const encoded = encodeSession(SESSION);
    const parts = encoded.split('.');
    const ciphertext = parts[2] ?? '';
    parts[2] = `${ciphertext.startsWith('a') ? 'b' : 'a'}${ciphertext.slice(1)}`;

    expect(decodeSession(parts.join('.'))).toBeNull();
  });
});
