import { z } from 'zod';
import type { ResolvedSecret, TestResult, Tester } from './types.js';

const Target = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535).default(6379),
  db: z.coerce.number().int().min(0).max(15).default(0),
  user: z.string().optional(),
  tls: z.coerce.boolean().optional(),
});

type RedisTarget = z.infer<typeof Target>;

export const redisTester: Tester<RedisTarget> = {
  type: 'redis',
  schema: Target,
  async test(secret: ResolvedSecret, target: RedisTarget): Promise<TestResult> {
    const start = Date.now();
    const { default: Redis } = await import('ioredis');
    const client = new Redis({
      host: target.host,
      port: target.port,
      db: target.db,
      ...(target.user ? { username: target.user } : {}),
      password: secret.value,
      ...(target.tls ? { tls: {} } : {}),
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      connectTimeout: 5000,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      const ok = pong === 'PONG';
      return { ok, latency_ms: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
    }
  },
};
