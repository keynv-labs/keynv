import { describe, it, expect } from 'vitest';
import { envTone } from './badge-utils';

describe('envTone', () => {
  it('maps "prod" to env-prod', () => {
    expect(envTone('prod')).toBe('env-prod');
  });

  it('maps "production" to env-prod', () => {
    expect(envTone('production')).toBe('env-prod');
  });

  it('maps "stg" to env-stg', () => {
    expect(envTone('stg')).toBe('env-stg');
  });

  it('maps "staging" to env-stg', () => {
    expect(envTone('staging')).toBe('env-stg');
  });

  it('maps "dev" to env-dev', () => {
    expect(envTone('dev')).toBe('env-dev');
  });

  it('maps unknown tiers to env-dev', () => {
    expect(envTone('test')).toBe('env-dev');
    expect(envTone('review')).toBe('env-dev');
  });

  it('is case-insensitive', () => {
    expect(envTone('Prod')).toBe('env-prod');
    expect(envTone('STAGING')).toBe('env-stg');
  });
});
