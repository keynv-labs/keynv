import { mkdtemp, rm } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpApiClient } from './api-client.js';
import { type ResolverServer, resolveTokenToValue, startResolver } from './resolver.js';
import { _resetTokenStoreForTests, consumeReferenceToken, issueReferenceToken } from './tokens.js';

interface WireResponse {
  type: string;
  value?: string;
  message?: string;
}

/** One-shot newline-JSON request against the resolver socket. */
function rpc(sockPath: string, req: unknown): Promise<WireResponse> {
  return new Promise((resolve, reject) => {
    const c = createConnection(sockPath);
    let buf = '';
    c.setEncoding('utf8');
    c.on('error', reject);
    c.on('data', (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl === -1) return;
      try {
        resolve(JSON.parse(buf.slice(0, nl)) as WireResponse);
      } catch (e) {
        reject(e);
      }
      c.destroy();
    });
    c.write(`${JSON.stringify(req)}\n`);
  });
}

describe('startResolver (socket round-trip)', () => {
  let dir: string;
  let server: ResolverServer | null = null;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'keynv-mcp-res-'));
    process.env.KEYNV_MCP_RESOLVER_SOCKET = join(dir, 'r.sock');
    _resetTokenStoreForTests();
  });

  afterEach(async () => {
    if (server) await server.close();
    server = null;
    delete process.env.KEYNV_MCP_RESOLVER_SOCKET;
    await rm(dir, { recursive: true, force: true });
  });

  it('resolves a valid token to its value, single-use', async () => {
    const { reference_token } = issueReferenceToken('@proj.dev.api-key');
    server = await startResolver(async (t) => (consumeReferenceToken(t) ? 'SECRET-VALUE' : null));
    const sock = process.env.KEYNV_MCP_RESOLVER_SOCKET as string;

    const first = await rpc(sock, { type: 'resolve', token: reference_token });
    expect(first).toEqual({ type: 'value', value: 'SECRET-VALUE' });

    // Single-use: the second redemption fails.
    const second = await rpc(sock, { type: 'resolve', token: reference_token });
    expect(second.type).toBe('error');
  });

  it('returns an error for an unknown/expired token', async () => {
    server = await startResolver(async () => null);
    const sock = process.env.KEYNV_MCP_RESOLVER_SOCKET as string;
    const res = await rpc(sock, { type: 'resolve', token: 'keynv-ref:nope' });
    expect(res.type).toBe('error');
  });

  it('rejects a malformed request', async () => {
    server = await startResolver(async () => 'x');
    const sock = process.env.KEYNV_MCP_RESOLVER_SOCKET as string;
    const res = await rpc(sock, { type: 'nonsense' });
    expect(res).toEqual({ type: 'error', message: 'bad-request' });
  });

  it('never lets a resolver exception leak the value', async () => {
    server = await startResolver(async () => {
      throw new Error('boom');
    });
    const sock = process.env.KEYNV_MCP_RESOLVER_SOCKET as string;
    const res = await rpc(sock, { type: 'resolve', token: 'keynv-ref:x' });
    expect(res.type).toBe('error');
    expect(res.message).toMatch(/resolution failed/);
  });
});

describe('resolveTokenToValue', () => {
  beforeEach(() => _resetTokenStoreForTests());

  it('consumes the token and fetches the value via the api (single-use)', async () => {
    const { reference_token } = issueReferenceToken('@proj.dev.api-key');
    const calls: string[] = [];
    const fakeApi = {
      request: async (path: string) => {
        calls.push(path);
        if (path === '/v1/projects') return { projects: [{ id: 'p1', name: 'proj' }] };
        return { value: 'RESOLVED' };
      },
    } as unknown as McpApiClient;

    expect(await resolveTokenToValue(fakeApi, reference_token)).toBe('RESOLVED');
    expect(calls).toContain('/v1/projects');
    expect(calls).toContain('/v1/projects/p1/secrets/dev/api-key');
    // Single-use: a second redemption returns null without hitting the api.
    expect(await resolveTokenToValue(fakeApi, reference_token)).toBeNull();
  });

  it('returns null for an unknown project', async () => {
    const { reference_token } = issueReferenceToken('@ghost.dev.k');
    const fakeApi = {
      request: async () => ({ projects: [] }),
    } as unknown as McpApiClient;
    expect(await resolveTokenToValue(fakeApi, reference_token)).toBeNull();
  });
});
