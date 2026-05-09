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
  /**
   * Open POST /v1/auth/register so anyone can create a new org +
   * owner from the public web. OFF by default — self-hosters who
   * don't want public signup don't have to do anything. The keynv
   * Cloud (keynv.dev) instance flips this to true.
   *
   * Accepts the strings 'true' / '1' / 'yes' (case-insensitive);
   * everything else is false.
   */
  KEYNV_PUBLIC_REGISTRATION: z
    .string()
    .default('false')
    .transform((v) => /^(true|1|yes)$/i.test(v)),
  /**
   * Per-IP budget on the unauthenticated POST /v1/auth/register
   * endpoint. Tighter than the per-user authed limit — there is no
   * legitimate burst pattern for org-creation. Set to 0 to disable
   * (not recommended in production).
   */
  KEYNV_REGISTER_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(5),
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
