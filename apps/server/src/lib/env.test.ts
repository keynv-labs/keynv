import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('treats an empty KEYNV_JWT_SECRET as unset (so it auto-generates)', () => {
    // compose passes `${KEYNV_JWT_SECRET:-}` as an empty string; that must
    // not trip the min(32) check — it means "auto-generate one".
    const env = loadEnv({ KEYNV_JWT_SECRET: '' });
    expect(env.KEYNV_JWT_SECRET).toBeUndefined();
  });

  it('treats an empty KEYNV_WEB_URL as unset instead of failing url() validation', () => {
    const env = loadEnv({ KEYNV_WEB_URL: '' });
    expect(env.KEYNV_WEB_URL).toBeUndefined();
  });

  it('keeps a valid JWT secret', () => {
    const secret = 'x'.repeat(40);
    expect(loadEnv({ KEYNV_JWT_SECRET: secret }).KEYNV_JWT_SECRET).toBe(secret);
  });

  it('still rejects a non-empty JWT secret shorter than 32 chars', () => {
    expect(() => loadEnv({ KEYNV_JWT_SECRET: 'tooshort' })).toThrow(/invalid environment/);
  });

  it('applies defaults when nothing is set', () => {
    const env = loadEnv({});
    expect(env.KEYNV_PORT).toBe(8080);
    expect(env.KEYNV_JWT_SECRET_FILE).toBe('./jwt.secret');
    expect(env.KEYNV_JWT_SECRET).toBeUndefined();
  });
});
