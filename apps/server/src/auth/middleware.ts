import { eq } from 'drizzle-orm';
import { type Context, type MiddlewareHandler } from 'hono';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { verifyAccessToken } from './jwt.js';

export interface AuthedUser {
  id: string;
  email: string;
  org_id: string;
  org_role: 'owner' | 'admin' | 'developer' | 'reader';
  memberships: Array<{ project_id: string; role: 'lead' | 'developer' | 'reader' }>;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthedUser;
  }
}

interface DepsFn {
  (): { db: Db; jwtSecret: string };
}

/**
 * Bearer-token auth middleware. Loads the user (and project memberships
 * for RBAC checks) into c.var.user.
 */
export function authMiddleware(deps: DepsFn): MiddlewareHandler {
  return async (c: Context, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) return jsonError(c, 'auth.missing_token', 'Missing bearer token.');

    const { db, jwtSecret } = deps();

    let claims: Awaited<ReturnType<typeof verifyAccessToken>>;
    try {
      claims = await verifyAccessToken(token, { secret: jwtSecret });
    } catch (err) {
      const code = err instanceof Error && /exp/i.test(err.message)
        ? 'auth.token_expired'
        : 'auth.invalid_credentials';
      return jsonError(c, code, 'Invalid or expired access token.');
    }

    const userRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, claims.sub))
      .limit(1);
    const userRow = userRows[0];
    if (!userRow) {
      return jsonError(c, 'auth.invalid_credentials', 'Token references unknown user.');
    }

    const memberRows = await db
      .select({ project_id: schema.memberships.project_id, role: schema.memberships.role })
      .from(schema.memberships)
      .where(eq(schema.memberships.user_id, userRow.id));

    c.set('user', {
      id: userRow.id,
      email: userRow.email,
      org_id: userRow.org_id,
      org_role: userRow.org_role,
      memberships: memberRows,
    });
    return next();
  };
}
