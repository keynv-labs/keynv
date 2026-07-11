import { z } from 'zod';

const ServerEnv = z.object({
  KEYNV_DB_PATH: z.string().min(1).default('./keynv.db'),
  KEYNV_MASTER_KEY_FILE: z.string().min(1).default('./master.key'),
  /**
   * JWT signing secret. Optional: when unset (or shorter than 32
   * chars) the server auto-generates one and persists it to
   * KEYNV_JWT_SECRET_FILE, so a single-command deploy needs no
   * operator-provided secret. Set it explicitly to pin a value or to
   * share one secret across horizontally-scaled replicas.
   */
  KEYNV_JWT_SECRET: z.string().min(32).optional(),
  KEYNV_JWT_SECRET_FILE: z.string().min(1).default('./jwt.secret'),
  KEYNV_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  KEYNV_WEB_URL: z.string().url().optional(),
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
  /**
   * Per-IP budget on the CLI device-code polling endpoint
   * (POST /v1/auth/cli/browser/poll). Needs much more headroom than
   * the register/login endpoints because the CLI polls every ~5s
   * while the user authorizes in their browser. Default 60/min
   * (5–10× a normal flow's poll count); set to 0 to disable.
   */
  KEYNV_BROWSER_POLL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(60),
  /**
   * Number of trusted reverse proxies in front of this server.
   * Controls which X-Forwarded-For entry is used to identify the
   * real client IP. With 1 trusted proxy (default), the second-to-
   * last entry is the client. Set to 0 to use the leftmost (unsafe
   * unless no untrusted proxy can inject headers).
   */
  KEYNV_TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).default(1),
  /**
   * Argon2id parameters for password hashing. Defaults are OWASP
   * 2024 minimums (19 MiB memory, 2 iterations, 1 thread). Raise
   * on beefier hardware for stronger resistance; individual login
   * latency scales ~linearly with timeCost and parallelism.
   */
  KEYNV_ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(19_456),
  KEYNV_ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
  KEYNV_ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),
});

export type ServerEnvT = z.infer<typeof ServerEnv>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnvT {
  // Treat empty-string vars (common with compose `${VAR:-}` defaults) as
  // unset, so schema defaults / optionals apply instead of failing
  // validation (e.g. an empty KEYNV_JWT_SECRET means "auto-generate").
  const cleaned: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(source)) {
    cleaned[k] = v === '' ? undefined : v;
  }
  const parsed = ServerEnv.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`keynv-server: invalid environment\n${issues}`);
  }
  return parsed.data;
}
