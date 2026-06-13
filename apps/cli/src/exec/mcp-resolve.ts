import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Client for the keynv-mcp reference-token resolver.
 *
 * `keynv.use_secret` (MCP) hands the agent an opaque single-use token;
 * `keynv exec --resolve NAME=<token>` redeems it here, over a local 0600
 * socket served by the running keynv-mcp process, and injects the resolved
 * value into the privileged subprocess. The value never returns to the agent.
 *
 * The socket path formula is kept byte-for-byte identical to the MCP side
 * (apps/mcp/src/resolver.ts) so the two processes meet without configuration.
 */
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

export type ResolveResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string };

/**
 * Redeems a reference token to its value via the keynv-mcp resolver socket.
 * Returns a discriminated result rather than throwing, so the caller can
 * print an actionable message. A missing socket (mcp not running) surfaces
 * as `{ ok: false, error: 'not-running' }`.
 */
export function resolveReferenceToken(token: string, timeoutMs = 5000): Promise<ResolveResult> {
  const path = resolverSocketPath();
  return new Promise<ResolveResult>((resolve) => {
    const socket = createConnection(path);
    let buffer = '';
    let settled = false;
    const settle = (result: ResolveResult): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(
      () => settle({ ok: false, error: 'timed out waiting for keynv-mcp resolver' }),
      timeoutMs,
    );
    socket.once('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
        settle({ ok: false, error: 'not-running' });
      } else {
        settle({ ok: false, error: err.message });
      }
    });
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      const nl = buffer.indexOf('\n');
      if (nl === -1) return;
      clearTimeout(timer);
      try {
        const resp = JSON.parse(buffer.slice(0, nl)) as
          | { type: 'value'; value: string }
          | { type: 'error'; message: string };
        if (resp.type === 'value') settle({ ok: true, value: resp.value });
        else settle({ ok: false, error: resp.message });
      } catch {
        settle({ ok: false, error: 'malformed response from keynv-mcp resolver' });
      }
    });

    socket.write(`${JSON.stringify({ type: 'resolve', token })}\n`);
  });
}
