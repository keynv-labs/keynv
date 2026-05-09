import { Hono } from 'hono';
import type { Db } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { auditRoutes } from './routes/audit.js';
import { healthRoute } from './routes/health.js';
import { memberRoutes } from './routes/members.js';
import { projectRoutes } from './routes/projects.js';
import { secretRoutes } from './routes/secrets.js';
import { userRoutes } from './routes/users.js';
import { whoamiRoute } from './routes/whoami.js';
import { jsonError } from './lib/errors.js';

export interface AppDeps {
  db: Db;
  jwtSecret: string;
  accessTtlS: number;
  refreshTtlS: number;
  getKek: () => Uint8Array;
  version: string;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

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
    // Avoid leaking internals — log server-side, surface request id only.
    // biome-ignore lint/suspicious/noConsoleLog: temporary until pino wiring (Phase 5)
    console.error('[keynv-server] unhandled error', err);
    return jsonError(c, 'internal_error', 'Internal error.');
  });

  return app;
}
