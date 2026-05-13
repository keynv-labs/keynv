import { and, eq } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import type { Db } from '../db/index.js';
import { schema } from '../db/index.js';
import { jsonError } from '../lib/errors.js';
import { isCliToken, validateCliToken } from './cli-tokens.js';
import { verifyAccessToken } from './jwt.js';

export interface AuthedUser {
  id: string;
  email: string;
  /** The resolved active org for this request (from header or primary org). */
  org_id: string;
  /** The user's role in the *active* org. */
  org_role: 'owner' | 'admin' | 'developer' | 'reader';
  /** Every org the user belongs to (primary + org_memberships). */
  org_ids: string[];
  /** Project-level memberships for RBAC. */
  memberships: Array<{ project_id: string; role: 'lead' | 'developer' | 'reader' }>;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthedUser;
  }
}

type DepsFn = () => { db: Db; jwtSecret: string };

/**
 * Bearer-token auth middleware. Loads the user (and org/project
 * memberships for RBAC checks) into c.var.user.
 *
 * Active org resolution (multi-org Phase 6):
 *   1. X-Keynv-Org header — explicit override from the web panel or CLI.
 *   2. Fallback to users.org_id (the primary org the user registered under).
 *
 * The JWT's embedded org_id is NOT the active-org source of truth —
 * a user may belong to multiple orgs and switch between them without
 * re-authenticating.
 */
export function authMiddleware(deps: DepsFn): MiddlewareHandler {
  return async (c: Context, next) => {
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) return jsonError(c, 'auth.missing_token', 'Missing bearer token.');

    const { db, jwtSecret } = deps();

    let userId: string;
    if (isCliToken(token)) {
      const validated = await validateCliToken(db, token);
      if (!validated) {
        return jsonError(c, 'auth.invalid_credentials', 'Invalid or revoked CLI token.');
      }
      userId = validated.user_id;
    } else {
      let claims: Awaited<ReturnType<typeof verifyAccessToken>>;
      try {
        claims = await verifyAccessToken(token, { secret: jwtSecret });
      } catch (err) {
        const code =
          err instanceof Error && /exp/i.test(err.message)
            ? 'auth.token_expired'
            : 'auth.invalid_credentials';
        return jsonError(c, code, 'Invalid or expired access token.');
      }
      userId = claims.sub;
    }

    const userRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const userRow = userRows[0];
    if (!userRow) {
      return jsonError(c, 'auth.invalid_credentials', 'Token references unknown user.');
    }

    // Collect all org IDs the user belongs to.
    const primaryOrgId = userRow.org_id;
    const omRows = await db
      .select({ org_id: schema.org_memberships.org_id })
      .from(schema.org_memberships)
      .where(eq(schema.org_memberships.user_id, userRow.id));
    const allOrgIds: string[] = [primaryOrgId, ...omRows.map((r) => r.org_id).filter((id) => id !== primaryOrgId)];

    // Resolve the active org for this request.
    const requestedOrgId = c.req.header('x-keynv-org');
    const activeOrgId = requestedOrgId && allOrgIds.includes(requestedOrgId) ? requestedOrgId : primaryOrgId;

    // Determine the user's role in the active org.
    let activeRole = userRow.org_role;
    if (activeOrgId !== primaryOrgId) {
      const match = await db
        .select({ role: schema.org_memberships.role })
        .from(schema.org_memberships)
        .where(
          and(
            eq(schema.org_memberships.user_id, userRow.id),
            eq(schema.org_memberships.org_id, activeOrgId),
          ),
        )
        .limit(1);
      if (match[0]) activeRole = match[0].role;
    }

    const memberRows = await db
      .select({ project_id: schema.memberships.project_id, role: schema.memberships.role })
      .from(schema.memberships)
      .where(eq(schema.memberships.user_id, userRow.id));

    c.set('user', {
      id: userRow.id,
      email: userRow.email,
      org_id: activeOrgId,
      org_role: activeRole,
      org_ids: allOrgIds,
      memberships: memberRows,
    });
    return next();
  };
}
