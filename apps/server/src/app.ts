import { createHmac } from 'node:crypto';
import { audit as auditCore } from '@keynv/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from './db/index.js';
import { jsonError } from './lib/errors.js';
import { type Logger, makeLogger } from './lib/logger.js';
import { type MetricsRegistry, createMetricsRegistry, metricsMiddleware } from './lib/metrics.js';
import { approvalRoutes, orgApprovalRoutes } from './routes/approvals.js';
import { auditRoutes } from './routes/audit.js';
import { authRoutes } from './routes/auth.js';
import { cliTokenRoutes } from './routes/cli-tokens.js';
import { healthRoute } from './routes/health.js';
import { memberRoutes } from './routes/members.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { orgRoutes } from './routes/org.js';
import { preferenceRoutes } from './routes/preferences.js';
import { projectRoutes } from './routes/projects.js';
import { searchRoutes } from './routes/search.js';
import { secretRoutes } from './routes/secrets.js';
import { userRoutes } from './routes/users.js';
import { whoamiRoute } from './routes/whoami.js';

export interface AppDeps {
  db: Db;
  jwtSecret: string;
  accessTtlS: number;
  refreshTtlS: number;
  webUrl?: string | undefined;
  getKek: () => Uint8Array;
  version: string;
  /**
   * Per-user request-budget per minute on authenticated routes. Loaded
   * from KEYNV_RATE_LIMIT_PER_MINUTE in production; tests pass a high
   * value (or 0 to disable) when they need to make many calls.
   * Defaults to 120 in `loadEnv`; explicit here so the test harness
   * can opt out.
   */
  rateLimitPerMinute?: number;
  /**
   * Whether POST /v1/auth/register is open. Forwarded to authRoutes;
   * also surfaced on /v1/health so the web client can render the
   * /register page conditionally.
   */
  publicRegistrationEnabled?: boolean;
  /**
   * Per-IP budget for POST /v1/auth/register. Independent from
   * rateLimitPerMinute (the per-user authed-route budget).
   */
  registerRateLimitPerMinute?: number;
  /**
   * Per-IP budget for POST /v1/auth/cli/browser/poll. Defaults to
   * 60/min so the CLI's device-code polling loop (5s cadence by
   * default) has comfortable headroom across the auth window.
   */
  browserPollRateLimitPerMinute?: number;
  /**
   * Optional pino logger. Defaults to a fresh instance with the same
   * redaction paths configured in lib/logger.ts. Tests pass a silent
   * logger to keep their output clean.
   */
  logger?: Logger;
  /** Optional metrics registry; tests can inject one to isolate counters. */
  metrics?: MetricsRegistry;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const logger = deps.logger ?? makeLogger(process.env['KEYNV_LOG_LEVEL'] ?? 'info');
  const metrics = deps.metrics ?? createMetricsRegistry();

  // Make the audit hash chain tamper-evident (audit finding M8): derive a
  // domain-separated HMAC key from the KEK and bind every new audit row to
  // it. Without this the chain falls back to keyless SHA-256, which anyone
  // with DB write access could recompute after editing a row. Existing
  // keyless rows still verify (their hashes carry no `v1:` prefix).
  auditCore.configureChainKey(
    new Uint8Array(
      createHmac('sha256', Buffer.from(deps.getKek())).update('keynv-audit-chain-v1').digest(),
    ),
  );

  app.use('*', metricsMiddleware(metrics));

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (c.req.header('x-forwarded-proto') === 'https' || c.req.url.startsWith('https://')) {
      c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
  });

  /**
   * CORS — only allows the configured KEYNV_WEB_URL (if set) so that
   * browsers can make cross-origin fetch calls from the web dashboard.
   * When KEYNV_WEB_URL is not configured (API-only deployment behind
   * a same-origin reverse proxy) no CORS headers are emitted.
   */
  if (deps.webUrl) {
    app.use(
      '*',
      cors({
        origin: deps.webUrl,
        credentials: true,
        allowHeaders: ['Authorization', 'Content-Type', 'X-Keynv-Org'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      }),
    );
  }

  app.route(
    '/v1/health',
    healthRoute({
      db: deps.db,
      version: deps.version,
      publicRegistrationEnabled: deps.publicRegistrationEnabled ?? false,
    }),
  );
  app.get('/metrics', (c) => {
    c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return c.text(metrics.render());
  });
  app.route('/v1/auth', authRoutes(deps));
  app.route('/v1/whoami', whoamiRoute(deps));
  app.route('/v1/users', userRoutes(deps));
  app.route('/v1/projects', projectRoutes(deps));
  // member + secret routes share the /v1/projects prefix
  app.route('/v1/projects', memberRoutes(deps));
  app.route('/v1/projects', secretRoutes(deps));
  app.route('/v1/audit', auditRoutes(deps));
  app.route('/v1/cli-tokens', cliTokenRoutes(deps));
  app.route('/v1/onboarding', onboardingRoutes(deps));
  app.route('/v1/org', orgRoutes(deps));
  app.route('/v1/users/preferences', preferenceRoutes(deps));
  // approvalRoutes mounts /:projectId/approvals/* on the same prefix.
  app.route('/v1/projects', approvalRoutes(deps));
  app.route('/v1/approvals', orgApprovalRoutes(deps));
  app.route('/v1', searchRoutes(deps));

  app.notFound((c) => jsonError(c, 'validation.failed', 'Not found.'));
  app.onError((err, c) => {
    // Pino's `redact` config (apps/server/src/lib/logger.ts) scrubs
    // common credential-shaped fields from the serialized error so a
    // pg/mysql/etc driver error containing a connection-string
    // fragment doesn't make it into the stdout log (audit finding H5).
    logger.error(
      {
        err,
        request_id: c.req.header('x-request-id'),
        path: c.req.path,
        method: c.req.method,
      },
      'unhandled error',
    );
    return jsonError(c, 'internal_error', 'Internal error.');
  });

  return app;
}
