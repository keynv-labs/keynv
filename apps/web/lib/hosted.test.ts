import { afterEach, describe, expect, it } from 'vitest';
import { isHostedInstance } from './hosted';

describe('isHostedInstance', () => {
  const saved = process.env.KEYNV_HOSTED;
  afterEach(() => {
    if (saved === undefined) delete process.env.KEYNV_HOSTED;
    else process.env.KEYNV_HOSTED = saved;
  });

  it('is false by default (self-host)', () => {
    delete process.env.KEYNV_HOSTED;
    expect(isHostedInstance()).toBe(false);
  });

  it('accepts true / 1 / yes case-insensitively', () => {
    for (const v of ['true', 'TRUE', '1', 'yes', 'Yes']) {
      process.env.KEYNV_HOSTED = v;
      expect(isHostedInstance()).toBe(true);
    }
  });

  it('treats other values as self-host', () => {
    for (const v of ['', 'false', '0', 'no', 'off']) {
      process.env.KEYNV_HOSTED = v;
      expect(isHostedInstance()).toBe(false);
    }
  });
});
