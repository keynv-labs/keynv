import { describe, expect, it } from 'vitest';
import { envName, secretKey, secretValue, testerName } from './index.js';

describe('domain validation schemas', () => {
  it('accepts shipped tester names only', () => {
    expect(testerName.safeParse('postgres').success).toBe(true);
    expect(testerName.safeParse('mongodb').success).toBe(false);
  });

  it('keeps environment names lowercase kebab-case', () => {
    expect(envName.safeParse('prod-eu').success).toBe(true);
    expect(envName.safeParse('Prod').success).toBe(false);
  });

  it('allows env-style secret keys and caps value size', () => {
    expect(secretKey.safeParse('DATABASE_URL').success).toBe(true);
    expect(secretKey.safeParse('DATABASE.URL').success).toBe(false);
    expect(secretValue.safeParse('x'.repeat(64 * 1024 + 1)).success).toBe(false);
  });
});
