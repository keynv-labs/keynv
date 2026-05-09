import { z } from 'zod';
import type { ResolvedSecret, TestResult, Tester } from './types.js';

const Target = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  ssl: z.coerce.boolean().optional(),
});

type PostgresTarget = z.infer<typeof Target>;

export const postgresTester: Tester<PostgresTarget> = {
  type: 'postgres',
  schema: Target,
  async test(secret: ResolvedSecret, target: PostgresTarget): Promise<TestResult> {
    const start = Date.now();
    // Lazy-load to keep the dep optional for environments that don't
    // exercise this tester (e.g., running only the http tester).
    const { Client } = await import('pg');
    const client = new Client({
      host: target.host,
      port: target.port,
      database: target.database,
      user: target.user,
      password: secret.value,
      ssl: target.ssl ?? false,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
    });
    try {
      await client.connect();
      const r = await client.query<{ ok: number; v: string }>('SELECT 1 AS ok, version() AS v');
      const ok = r.rows[0]?.ok === 1;
      return {
        ok,
        latency_ms: Date.now() - start,
        ...(ok ? { info: { server_version: r.rows[0]?.v } } : {}),
      };
    } catch (err) {
      return {
        ok: false,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await client.end().catch(() => {
        /* ignore */
      });
    }
  },
};
