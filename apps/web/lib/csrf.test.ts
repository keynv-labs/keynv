import { describe, expect, it } from 'vitest';
import { createCsrfToken, csrfFieldName, requireCsrf, verifyCsrfToken } from './csrf';

describe('csrf tokens', () => {
  it('accepts a fresh token', () => {
    const token = createCsrfToken(1_000);

    expect(verifyCsrfToken(token, 1_000)).toBe(true);
  });

  it('rejects a tampered token', () => {
    const token = createCsrfToken(1_000);
    const [payload, mac] = token.split('.');
    const tampered = `${payload}.${mac?.slice(0, -1)}${mac?.endsWith('a') ? 'b' : 'a'}`;

    expect(verifyCsrfToken(tampered, 1_000)).toBe(false);
  });

  it('rejects an expired token', () => {
    const token = createCsrfToken(1_000);

    expect(verifyCsrfToken(token, 1_000 + 2 * 60 * 60 * 1_000 + 1)).toBe(false);
  });

  it('returns a safe action error for missing tokens', () => {
    const formData = new FormData();

    expect(requireCsrf(formData)).toEqual({
      error: 'Security check failed. Refresh the page and try again.',
    });
  });

  it('accepts a token from the configured form field', () => {
    const formData = new FormData();
    formData.set(csrfFieldName(), createCsrfToken());

    expect(requireCsrf(formData)).toBeNull();
  });
});
