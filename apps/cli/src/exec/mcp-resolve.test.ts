import { mkdtemp, rm } from 'node:fs/promises';
import { type Server, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveReferenceToken } from './mcp-resolve.js';

/** Spins up a fake resolver server that replies with `reply` to any request. */
function fakeResolver(sockPath: string, reply: unknown): Promise<Server> {
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    socket.on('data', () => {
      socket.write(`${JSON.stringify(reply)}\n`);
      socket.end();
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => server.listen(sockPath, () => resolve(server)));
}

describe('resolveReferenceToken', () => {
  let dir: string;
  let server: Server | null = null;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'keynv-cli-res-'));
    process.env.KEYNV_MCP_RESOLVER_SOCKET = join(dir, 'r.sock');
  });

  afterEach(async () => {
    await new Promise<void>((res) => (server ? server.close(() => res()) : res()));
    server = null;
    delete process.env.KEYNV_MCP_RESOLVER_SOCKET;
    await rm(dir, { recursive: true, force: true });
  });

  it('redeems a token to its value', async () => {
    server = await fakeResolver(process.env.KEYNV_MCP_RESOLVER_SOCKET as string, {
      type: 'value',
      value: 'THE-SECRET',
    });
    const res = await resolveReferenceToken('keynv-ref:abc');
    expect(res).toEqual({ ok: true, value: 'THE-SECRET' });
  });

  it('surfaces a resolver error', async () => {
    server = await fakeResolver(process.env.KEYNV_MCP_RESOLVER_SOCKET as string, {
      type: 'error',
      message: 'token invalid, expired, or already used',
    });
    const res = await resolveReferenceToken('keynv-ref:abc');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/invalid|expired|used/);
  });

  it('reports not-running when no resolver socket exists', async () => {
    // No server started → connect fails with ENOENT.
    const res = await resolveReferenceToken('keynv-ref:abc');
    expect(res).toEqual({ ok: false, error: 'not-running' });
  });
});
