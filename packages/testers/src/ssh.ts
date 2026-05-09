import { z } from 'zod';
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
});

type SshTarget = z.infer<typeof Target>;

export const sshTester: Tester<SshTarget> = {
  type: 'ssh',
  schema: Target,
  async test(secret: ResolvedSecret, target: SshTarget): Promise<TestResult> {
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
        client.connect({
          host: target.host,
          port: target.port,
          username: target.user,
          ...(target.auth === 'password'
            ? { password: secret.value }
            : { privateKey: secret.value }),
          readyTimeout: 5000,
        });
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
