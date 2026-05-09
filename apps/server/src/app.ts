import { Hono } from 'hono';
import type { Db } from './db/index.js';
import { jsonError } from './lib/errors.js';
import { type Logger, makeLogger } from './lib/logger.js';
import { auditRoutes } from './routes/audit.js';
import { authRoutes } from './routes/auth.js';
import { healthRoute } from './routes/health.js';
import { memberRoutes } from './routes/members.js';
import { projectRoutes } from './routes/projects.js';
import { secretRoutes } from './routes/secrets.js';
import { userRoutes } from './routes/users.js';
import { whoamiRoute } from './routes/whoami.js';

export interface AppDeps {
  db: Db;
  jwtSecret: string;
  accessTtlS: number;
  refreshTtlS: number;
  getKek: () => Uint8Array;
  version: string;
  /**
   * Optional pino logger. Defaults to a fresh instance with the same
   * redaction paths configured in lib/logger.ts. Tests pass a silent
   * logger to keep their output clean.
   */
  logger?: Logger;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const logger = deps.logger ?? makeLogger(process.env['KEYNV_LOG_LEVEL'] ?? 'info');

  app.route('/v1/health', healthRoute({ db: deps.db, version: deps.version }));
  app.route('/v1/auth', authRoutes(deps));
  app.route('/v1/whoami', whoamiRoute(deps));
  app.route('/v1/users', userRoutes(deps));
  app.route('/v1/projects', projectRoutes(deps));
  // member + secret routes share the /v1/projects prefix
  app.route('/v1/projects', memberRoutes(deps));
  app.route('/v1/projects', secretRoutes(deps));
  app.route('/v1/audit', auditRoutes(deps));

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
