import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isBlockedHost } from './ssrf.js';
import type { ResolvedSecret, TestResult, Tester } from './types.js';

const Target = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(22),
  user: z.string().min(1),
  /**
   * 'password' uses secret.value as a password; 'key' uses
   * secret.value as a PEM-encoded private key.
   */
  auth: z.enum(['password', 'key']).default('password'),
  /**
   * Expected SHA-256 fingerprint of the server host public key
   * (base64, no padding). When set, the connection is rejected if
   * the key does not match — preventing MITM attacks.
   */
  host_key_sha256: z.string().min(1).optional(),
});

type SshTarget = z.infer<typeof Target>;

export const sshTester: Tester<SshTarget> = {
  type: 'ssh',
  schema: Target,
  async test(secret: ResolvedSecret, target: SshTarget): Promise<TestResult> {
    if (isBlockedHost(target.host)) {
      return {
        ok: false,
        latency_ms: 0,
        error: 'Target host is blocked (private/internal IP or metadata endpoint).',
      };
    }
    const start = Date.now();
    const { Client } = await import('ssh2');
    return new Promise<TestResult>((resolve) => {
      const client = new Client();
      let settled = false;

      const settle = (result: TestResult): void => {
        if (settled) return;
        settled = true;
        try {
          client.end();
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      client.once('ready', () => {
        client.exec('true', (err, stream) => {
          if (err) {
            settle({ ok: false, latency_ms: Date.now() - start, error: err.message });
            return;
          }
          stream
            .on('close', (code: number) => {
              settle({
                ok: code === 0,
                latency_ms: Date.now() - start,
                ...(code === 0 ? {} : { error: `remote exit code ${code}` }),
              });
            })
            .on('error', (e: Error) => {
              settle({ ok: false, latency_ms: Date.now() - start, error: e.message });
            });
          // We don't need stdout/stderr; just drain.
          stream.resume();
          stream.stderr?.resume();
        });
      });
      client.once('error', (err) => {
        settle({ ok: false, latency_ms: Date.now() - start, error: err.message });
      });

      try {
        const connectOpts: Record<string, unknown> = {
          host: target.host,
          port: target.port,
          username: target.user,
          readyTimeout: 5000,
        };
        if (target.auth === 'password') {
          connectOpts.password = secret.value;
        } else {
          connectOpts.privateKey = secret.value;
        }
        if (target.host_key_sha256) {
          const expected = target.host_key_sha256;
          connectOpts.hostVerifier = (key: unknown) => {
            if (typeof key === 'string') {
              return (
                createHash('sha256').update(key, 'utf8').digest('base64').replace(/=+$/, '') ===
                expected
              );
            }
            if (Buffer.isBuffer(key)) {
              return (
                createHash('sha256').update(key).digest('base64').replace(/=+$/, '') === expected
              );
            }
            return false;
          };
        }
        client.connect(connectOpts);
      } catch (err) {
        settle({
          ok: false,
          latency_ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  },
};
