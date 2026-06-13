import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { credentialsFromEnv } from './store.js';

describe('credentialsFromEnv', () => {
  const saved = {
    KEYNV_TOKEN: process.env.KEYNV_TOKEN,
    KEYNV_SERVER_URL: process.env.KEYNV_SERVER_URL,
    KEYNV_ORG: process.env.KEYNV_ORG,
  };

  beforeEach(() => {
    delete process.env.KEYNV_TOKEN;
    delete process.env.KEYNV_SERVER_URL;
    delete process.env.KEYNV_ORG;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns null when KEYNV_TOKEN is unset', () => {
    expect(credentialsFromEnv()).toBeNull();
  });

  it('builds a cli_token credential from KEYNV_TOKEN + KEYNV_SERVER_URL', () => {
    process.env.KEYNV_TOKEN = 'kt_example';
    process.env.KEYNV_SERVER_URL = 'https://api.example.test';
    const creds = credentialsFromEnv();
    expect(creds).toMatchObject({
      auth_kind: 'cli_token',
      server_url: 'https://api.example.test',
      access_token: 'kt_example',
      refresh_token: '',
    });
  });

  it('falls back to the default server URL when KEYNV_SERVER_URL is unset', () => {
    process.env.KEYNV_TOKEN = 'kt_example';
    expect(credentialsFromEnv()?.server_url).toBe('https://api.keynv.dev');
  });
});
