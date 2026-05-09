import { type Server, createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { httpTester } from './http.js';

let server: Server;
let url: string;

beforeEach(async () => {
  server = createServer((req, res) => {
    const auth = req.headers.authorization ?? '';
    const apiKey = req.headers['x-api-key'] ?? '';
    if (auth === 'Bearer good-token' || apiKey === 'good-key') {
      res.statusCode = 200;
      res.end('ok');
      return;
    }
    if (auth === `Basic ${Buffer.from('alice:good-pass').toString('base64')}`) {
      res.statusCode = 200;
      res.end('ok');
      return;
    }
    res.statusCode = 401;
    res.end('unauthorized');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (typeof addr === 'object' && addr) url = `http://127.0.0.1:${addr.port}/`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('httpTester', () => {
  it('returns ok for a valid bearer token (200 OK)', async () => {
    const r = await httpTester.test(
      { alias: '@x.dev.api', value: 'good-token' },
      { url, method: 'GET', auth: 'bearer', expect_status_min: 200, expect_status_max: 299 },
    );
    expect(r.ok).toBe(true);
    expect(r.info?.['status']).toBe(200);
  });

  it('returns fail for a wrong bearer token (401)', async () => {
    const r = await httpTester.test(
      { alias: '@x.dev.api', value: 'wrong-token' },
      { url, method: 'GET', auth: 'bearer', expect_status_min: 200, expect_status_max: 299 },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/401/);
  });

  it('handles basic auth', async () => {
    const r = await httpTester.test(
      { alias: '@x.dev.api', value: 'good-pass' },
      {
        url,
        method: 'GET',
        auth: 'basic',
        user: 'alice',
        expect_status_min: 200,
        expect_status_max: 299,
      },
    );
    expect(r.ok).toBe(true);
  });

  it('handles custom-header auth', async () => {
    const r = await httpTester.test(
      { alias: '@x.dev.api', value: 'good-key' },
      {
        url,
        method: 'GET',
        auth: 'header',
        header_name: 'x-api-key',
        expect_status_min: 200,
        expect_status_max: 299,
      },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects basic auth without user', async () => {
    const r = await httpTester.test(
      { alias: '@x.dev.api', value: 'p' },
      { url, method: 'GET', auth: 'basic', expect_status_min: 200, expect_status_max: 299 },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/target.user/);
  });
});
