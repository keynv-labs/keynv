import { describe, expect, it } from 'vitest';
import { PAYLOAD_SCHEMAS, validateAuditPayload } from './payload-schemas.js';
import type { AuditEventType } from './types.js';

describe('PAYLOAD_SCHEMAS', () => {
  it('has a schema for every documented event type', () => {
    const expected: AuditEventType[] = [
      'auth.login.allowed',
      'auth.login.denied',
      'auth.logout',
      'auth.refresh',
      'auth.password_change.allowed',
      'auth.password_change.denied',
      'cli_token.created',
      'cli_token.revoked',
      'user.invited',
      'user.removed',
      'user.role_changed',
      'project.created',
      'project.deleted',
      'project.dek_rotated',
      'environment.created',
      'member.added',
      'member.removed',
      'member.role_changed',
      'secret.created',
      'secret.read.allowed',
      'secret.read.denied',
      'secret.rotated',
      'secret.deleted',
      'secret.test.invoked',
      'approval.requested',
      'approval.granted',
      'approval.denied',
    ];
    for (const t of expected) {
      expect(PAYLOAD_SCHEMAS, `missing schema for ${t}`).toHaveProperty(t);
    }
  });
});

describe('validateAuditPayload — happy paths', () => {
  it.each([
    ['auth.login.allowed', { email: 'a@b.com' }],
    ['auth.logout', {}],
    ['project.created', { project_id: 'p_1', name: 'demo', environments: ['dev', 'prod'] }],
    ['project.deleted', { project_id: 'p_1', name: 'demo' }],
    ['member.added', { project_id: 'p_1', target_user_id: 'u_1', role: 'developer' }],
    ['secret.created', { project_id: 'p_1', env: 'dev', key: 'db_pass', version: 1 }],
    ['secret.read.allowed', { alias: '@p.dev.k', version: 3 }],
    [
      'secret.rotated',
      { project_id: 'p_1', env: 'dev', key: 'db_pass', from_version: 1, to_version: 2 },
    ],
    ['approval.requested', { alias: '@p.prod.db' }],
  ] as Array<[AuditEventType, Record<string, unknown>]>)(
    'accepts %s with %j',
    (eventType, payload) => {
      expect(() => validateAuditPayload(eventType, payload)).not.toThrow();
      expect(validateAuditPayload(eventType, payload)).toEqual(payload);
    },
  );
});

describe('validateAuditPayload — rejections', () => {
  it('rejects unknown fields (strict)', () => {
    expect(() =>
      validateAuditPayload('auth.login.allowed', { email: 'a@b.com', unexpected: 'x' }),
    ).toThrow(/audit payload validation failed/);
  });

  it('rejects missing required fields', () => {
    expect(() => validateAuditPayload('secret.created', { project_id: 'p_1' })).toThrow();
  });

  it('rejects non-JSON values (object cannot be coerced to number)', () => {
    expect(() =>
      validateAuditPayload('secret.read.allowed', {
        alias: '@p.dev.k',
        version: { not: 'a number' } as unknown as number,
      }),
    ).toThrow();
  });

  it('rejects wrong-type fields', () => {
    expect(() =>
      validateAuditPayload('secret.created', {
        project_id: 'p_1',
        env: 'dev',
        key: 'k',
        version: 'one',
      }),
    ).toThrow();
  });

  it('rejects event_type / payload mismatch', () => {
    expect(() =>
      validateAuditPayload('auth.logout', { email: 'a@b.com' } as Record<string, unknown>),
    ).toThrow();
  });
});
