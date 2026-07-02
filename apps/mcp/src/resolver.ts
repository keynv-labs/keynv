import { createHash } from 'node:crypto';
import { chmod, rm, stat } from 'node:fs/promises';
import { type Server, type Socket, createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { reference } from '@keynv/core';
import type { McpApiClient } from './api-client.js';
import { consumeReferenceToken, peekReferenceToken } from './tokens.js';

/**
 * Reference-token resolver IPC.
 *
 * `keynv.use_secret` (over MCP, to the agent) returns an opaque single-use
 * reference token — never the value. The agent then runs
 * `keynv exec --resolve NAME=<token> -- <cmd>`. That CLI process connects to
 * THIS local socket, redeems the token, and receives the resolved value over
 * a 0600 same-user socket. The value is injected into the privileged
 * subprocess and redacted from its output — it never crosses back to the
 * agent. The MCP server holds the only logged-in session; the agent only
 * ever holds opaque, single-use, 60s-TTL tokens.
 *
 * Protocol (newline-delimited JSON, one request per connection):
 *   client → server: { type: 'resolve', token: string }
 *   server → client: { type: 'value', value: string }
 *                  | { type: 'error', message: string }
 */

/** Well-known resolver socket path. Identical formula on the CLI side so the
 * two processes meet without configuration. Override with
 * KEYNV_MCP_RESOLVER_SOCKET. */
export function resolverSocketPath(): string {
  const override = process.env.KEYNV_MCP_RESOLVER_SOCKET;
  if (override) return override;
  const dir = join(homedir(), '.keynv');
  if (process.platform === 'win32') {
    const scope = createHash('sha256').update(dir).digest('hex').slice(0, 16);
    return `\\\\.\\pipe\\keynv-mcp-resolver-${scope}`;
  }
  return join(dir, 'mcp-resolver.sock');
}

export interface ResolverServer {
  readonly socketPath: string;
  close(): Promise<void>;
}

/**
 * Resolves a reference token to its secret value: validates the token
 * (single-use + TTL enforced in tokens.ts), fetches the value through the
 * MCP session, and only then consumes the token — so a transient fetch
 * failure leaves the token redeemable and the agent can retry. Returns null
 * when the token is unknown/expired/consumed, or the alias no longer
 * resolves. Never throws the raw value into an error.
 */
export async function resolveTokenToValue(
  api: McpApiClient,
  token: string,
): Promise<string | null> {
  const alias = peekReferenceToken(token);
  if (!alias) return null;
  const parsed = reference.parseAlias(alias);
  if (!parsed) return null;
  const projects = await api.request<{ projects: Array<{ id: string; name: string }> }>(
    '/v1/projects',
  );
  const projectId = projects.projects.find((p) => p.name === parsed.project)?.id;
  if (!projectId) return null;
  const data = await api.request<{ value: string }>(
    `/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}`,
  );
  // Value in hand — burn the token now so it stays single-use, but a
  // failure above never permanently invalidated a valid token.
  consumeReferenceToken(token);
  return data.value;
}

/**
 * Starts the resolver IPC server. `resolve` redeems a token to a value (or
 * null). Returns a handle with `close()` for orderly shutdown.
 */
export async function startResolver(
  resolve: (token: string) => Promise<string | null>,
): Promise<ResolverServer> {
  const path = resolverSocketPath();

  // Clean up a stale socket from a crashed previous run (unix sockets are
  // not auto-removed). Best-effort; usually ENOENT.
  try {
    await rm(path);
  } catch {
    // ignore
  }

  const server: Server = createServer((socket: Socket) => {
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      const nl = buffer.indexOf('\n');
      if (nl === -1) return;
      const line = buffer.slice(0, nl);
      void handleLine(line, socket, resolve);
    });
    socket.on('error', () => {
      // best-effort — client may have hung up
    });
  });

  return new Promise<ResolverServer>((resolveP, reject) => {
    server.once('error', reject);
    server.listen(path, () => {
      void chmodIfExists(path, 0o600);
      resolveP({
        socketPath: path,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

async function chmodIfExists(p: string, mode: number): Promise<void> {
  try {
    await stat(p);
    await chmod(p, mode);
  } catch {
    // ignore — Windows named pipes have no filesystem mode
  }
}

async function handleLine(
  line: string,
  socket: Socket,
  resolve: (token: string) => Promise<string | null>,
): Promise<void> {
  const reply = (obj: unknown): void => {
    try {
      socket.write(`${JSON.stringify(obj)}\n`);
    } catch {
      // client hung up
    }
    socket.end();
  };
  let req: { type?: string; token?: unknown };
  try {
    req = JSON.parse(line);
  } catch {
    return reply({ type: 'error', message: 'bad-json' });
  }
  if (req.type !== 'resolve' || typeof req.token !== 'string' || req.token.length === 0) {
    return reply({ type: 'error', message: 'bad-request' });
  }
  try {
    const value = await resolve(req.token);
    if (value === null) {
      return reply({ type: 'error', message: 'token invalid, expired, or already used' });
    }
    return reply({ type: 'value', value });
  } catch (err) {
    // Never echo the value; surface a generic resolution failure.
    return reply({
      type: 'error',
      message: `resolution failed: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }
}
