import { z } from 'zod';

const ServerEnv = z.object({
  KEYNV_DB_PATH: z.string().min(1).default('./keynv.db'),
  KEYNV_MASTER_KEY_FILE: z.string().min(1).default('./master.key'),
  KEYNV_JWT_SECRET: z.string().min(32),
  KEYNV_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  KEYNV_ACCESS_TOKEN_TTL_S: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  KEYNV_REFRESH_TOKEN_TTL_S: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 3600),
  KEYNV_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /**
   * Per-user request budget per minute on authenticated routes.
   * Closes Phase 5 audit Finding A1 (no rate limiter on Hono app).
   * Set to 0 to disable (not recommended in production).
   */
  KEYNV_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(120),
});

export type ServerEnvT = z.infer<typeof ServerEnv>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnvT {
  const parsed = ServerEnv.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`keynv-server: invalid environment\n${issues}`);
  }
  return parsed.data;
}
