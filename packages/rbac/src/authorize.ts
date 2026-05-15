import { ORG_LEVEL_ACTIONS, ROLE_ALLOWS_ACTION } from './matrix.js';
import type { Action, AuthorizeContext, Decision, Role } from './types.js';

/**
 * The single chokepoint for permission decisions. Every protected route
 * handler MUST call this and short-circuit on `deny` / `pending_approval`.
 *
 * Bypassing this for any reason is a code-review blocker — see
 * CLAUDE.md §security rules.
 */
export function authorize(action: Action, ctx: AuthorizeContext): Decision {
  const orgRole = ctx.user.org_role;
  const allowed = ROLE_ALLOWS_ACTION[action];

  // Org-level actions never consult memberships.
  if (ORG_LEVEL_ACTIONS.has(action)) {
    return allowed.includes(orgRole) ? 'allow' : 'deny';
  }

  // Project-level actions: owner/admin have implicit lead+ on every project.
  if (orgRole === 'owner' || orgRole === 'admin') {
    return allowed.includes(orgRole) ? 'allow' : 'deny';
  }

  // Non-owner/admin: a project context is required.
  const projectId = ctx.resource?.project_id;
  if (!projectId) return 'deny';

  const membership = ctx.user.memberships.find((m) => m.project_id === projectId);
  if (!membership) return 'deny';

  const effective: Role = membership.role;
  if (!allowed.includes(effective)) return 'deny';

  // Production-tier secret operations may require explicit approval for
  // developers when the environment is marked require_approval. Both
  // secret.read (viewing the decrypted value) and secret.test (sending
  // it over the network to a target) expose the value.
  if (
    (action === 'secret.read' || action === 'secret.test') &&
    effective === 'developer' &&
    ctx.resource?.environment_tier === 'production' &&
    ctx.resource?.require_approval
  ) {
    return ctx.approval?.granted ? 'allow' : 'pending_approval';
  }

  return 'allow';
}
