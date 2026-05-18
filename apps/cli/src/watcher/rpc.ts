import { rm, stat } from 'node:fs/promises';
import { type Server, type Socket, createConnection, createServer } from 'node:net';
import { join } from 'node:path';
import type { FingerprintRegistry } from './registry.js';
import { ensureStateDir, stateDir } from './state.js';

/**
 * Watcher RPC — tiny newline-delimited JSON protocol over a Unix
 * domain socket at `~/.local/share/keynv/watcher.sock` (chmod 0600).
 *
 * Messages:
 *   client → server: { type: 'register_value', value: string }
 *   server → client: { type: 'ack', fingerprint: string }
 *
 *   client → server: { type: 'ping' }
 *   server → client: { type: 'pong', registrySize: number }
 *
 * Failure semantics:
 *   - No watcher running ⇒ connect fails with ECONNREFUSED or ENOENT.
 *   - The CLI side treats both as "no-op silently" so `keynv exec`
 *     never blocks waiting on an absent watcher.
 *   - The CLI awaits an ack with a 200ms timeout; the watcher is
 *     usually local and replies in ~1ms.
 */

export function socketPath(): string {
  return process.env.KEYNV_WATCHER_SOCKET ?? join(stateDir(), 'watcher.sock');
}

export type RpcRequest =
  | { readonly type: 'register_value'; readonly value: string }
  | { readonly type: 'ping' };

export type RpcResponse =
  | { readonly type: 'ack'; readonly fingerprint: string }
  | { readonly type: 'pong'; readonly registrySize: number }
  | { readonly type: 'error'; readonly message: string };

export interface RpcServer {
  readonly socketPath: string;
  close(): Promise<void>;
}

/**
 * Start the watcher's RPC server. Caller passes the live
 * FingerprintRegistry instance; the server mutates it in response to
 * register requests.
 *
 * Returns a handle with `close()` for orderly shutdown. The caller
 * still owns the registry; we don't unregister on close.
 */
export async function startRpcServer(registry: FingerprintRegistry): Promise<RpcServer> {
  await ensureStateDir();
  const path = socketPath();

  // Clean up a stale socket from a previous run. `unix(7)` socket
  // files don't get auto-removed if the process crashed.
  try {
    await rm(path);
  } catch {
    // ignore — usually ENOENT
  }

  const server: Server = createServer((socket: Socket) => {
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic line iteration
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.length === 0) continue;
        handleLine(line, socket, registry);
      }
    });
    socket.on('error', () => {
      // best-effort — client may have hung up
    });
  });

  return new Promise<RpcServer>((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, () => {
      // POSIX-only chmod; on Windows the path would be a named pipe
      // and Node returns an error from listen() — we don't reach here.
      void chmodIfExists(path, 0o600).catch(() => {
        // best-effort
      });
      resolve({
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
    const { chmod } = await import('node:fs/promises');
    await chmod(p, mode);
  } catch {
    // ignore — caller is best-effort
  }
}

function handleLine(line: string, socket: Socket, registry: FingerprintRegistry): void {
  let req: RpcRequest;
  try {
    req = JSON.parse(line) as RpcRequest;
  } catch {
    const resp: RpcResponse = { type: 'error', message: 'bad-json' };
    socket.write(`${JSON.stringify(resp)}\n`);
    return;
  }
  try {
    if (req.type === 'register_value') {
      if (typeof req.value !== 'string' || req.value.length === 0) {
        const resp: RpcResponse = { type: 'error', message: 'bad-value' };
        socket.write(`${JSON.stringify(resp)}\n`);
        return;
      }
      const fp = registry.register(req.value);
      const resp: RpcResponse = { type: 'ack', fingerprint: fp };
      socket.write(`${JSON.stringify(resp)}\n`);
      return;
    }
    if (req.type === 'ping') {
      const resp: RpcResponse = { type: 'pong', registrySize: registry.size() };
      socket.write(`${JSON.stringify(resp)}\n`);
      return;
    }
    const resp: RpcResponse = { type: 'error', message: 'unknown-type' };
    socket.write(`${JSON.stringify(resp)}\n`);
  } catch (err) {
    const resp: RpcResponse = {
      type: 'error',
      message: `internal: ${(err as Error).message}`,
    };
    socket.write(`${JSON.stringify(resp)}\n`);
  }
}

/**
 * Fire-and-(briefly)-wait register call from a one-shot CLI process
 * (typically `keynv exec`). Honours `KEYNV_WATCHER_SOCKET`. Returns
 * the watcher's ack fingerprint, or null if no watcher is running
 * (so callers can fail-open silently).
 *
 * Timeout: 200ms. The watcher is local; if it doesn't respond in that
 * window, assume something's wrong and don't block the parent.
 */
export async function registerValueWithWatcher(
  value: string,
  timeoutMs = 200,
): Promise<string | null> {
  if (value.length === 0) return null;
  const path = socketPath();

  return new Promise<string | null>((resolve) => {
    const socket = createConnection(path);
    let buffer = '';
    let settled = false;
    const settle = (result: string | null): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => settle(null), timeoutMs);
    socket.once('error', () => {
      clearTimeout(timer);
      settle(null);
    });
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      const nl = buffer.indexOf('\n');
      if (nl === -1) return;
      const line = buffer.slice(0, nl);
      try {
        const resp = JSON.parse(line) as RpcResponse;
        clearTimeout(timer);
        if (resp.type === 'ack') settle(resp.fingerprint);
        else settle(null);
      } catch {
        clearTimeout(timer);
        settle(null);
      }
    });

    socket.write(`${JSON.stringify({ type: 'register_value', value })}\n`);
  });
}
