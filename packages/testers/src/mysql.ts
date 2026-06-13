import { z } from 'zod';
import { isBlockedHostResolved } from './ssrf.js';
import type { ResolvedSecret, TestResult, Tester } from './types.js';

const Target = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(3306),
  database: z.string().min(1).optional(),
  user: z.string().min(1),
  ssl: z.coerce.boolean().optional(),
});

type MysqlTarget = z.infer<typeof Target>;

export const mysqlTester: Tester<MysqlTarget> = {
  type: 'mysql',
  schema: Target,
  async test(secret: ResolvedSecret, target: MysqlTarget): Promise<TestResult> {
    if (await isBlockedHostResolved(target.host)) {
      return {
        ok: false,
        latency_ms: 0,
        error: 'Target host is blocked (private/internal IP or metadata endpoint).',
      };
    }
    const start = Date.now();
    const mysql = await import('mysql2/promise');
    const conn = await mysql
      .createConnection({
        host: target.host,
        port: target.port,
        ...(target.database ? { database: target.database } : {}),
        user: target.user,
        password: secret.value,
        ...(target.ssl !== false ? { ssl: {} } : {}),
        connectTimeout: 5000,
      })
      .catch((err: unknown) => {
        return {
          __error__: err instanceof Error ? err.message : String(err),
        } as { __error__: string };
      });
    if ('__error__' in conn) {
      return { ok: false, latency_ms: Date.now() - start, error: conn.__error__ };
    }
    try {
      const [rows] = await conn.query('SELECT VERSION() AS v');
      const v = (rows as Array<{ v: string }>)[0]?.v;
      return { ok: true, latency_ms: Date.now() - start, info: { server_version: v } };
    } catch (err) {
      return {
        ok: false,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await conn.end().catch(() => {
        /* ignore */
      });
    }
  },
};
