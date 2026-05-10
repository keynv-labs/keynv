import type { Action, Role } from './types.js';

/**
 * Actions that depend solely on the user's org role; no project
 * membership lookup is performed.
 */
export const ORG_LEVEL_ACTIONS = new Set<Action>([
  'org.transfer',
  'org.billing',
  'org.kek_rotate',
  'user.invite',
  'user.remove',
  'user.role_change',
  'project.create',
  'project.delete',
]);

/**
 * The single source of truth for which roles can perform which actions.
 *
 * For org-level actions, the relevant role is the user's `org_role`.
 * For project-level actions, the relevant role is whichever applies:
 *  - `owner` / `admin` win directly (implicit access to all projects).
 *  - Otherwise, the membership role on the target project.
 */
export const ROLE_ALLOWS_ACTION: Record<Action, ReadonlyArray<Role>> = {
  // Org-level
  'org.transfer': ['owner'],
  'org.billing': ['owner'],
  'org.kek_rotate': ['owner'],
  'user.invite': ['owner', 'admin'],
  'user.remove': ['owner', 'admin'],
  'user.role_change': ['owner', 'admin'],
  'project.create': ['owner', 'admin'],
  'project.delete': ['owner', 'admin'],
  // Project-level
  'project.describe': ['owner', 'admin', 'lead', 'developer', 'reader'],
  'environment.create': ['owner', 'admin', 'lead'],
  'member.add': ['owner', 'admin', 'lead'],
  'member.remove': ['owner', 'admin', 'lead'],
  'member.role_change': ['owner', 'admin', 'lead'],
  'secret.create': ['owner', 'admin', 'lead'],
  'secret.update': ['owner', 'admin', 'lead'],
  'secret.delete': ['owner', 'admin', 'lead'],
  'secret.rotate': ['owner', 'admin', 'lead'],
  'secret.read': ['owner', 'admin', 'lead', 'developer'],
  'secret.list_names': ['owner', 'admin', 'lead', 'developer', 'reader'],
  'secret.test': ['owner', 'admin', 'lead', 'developer'],
  'audit.read': ['owner', 'admin', 'lead', 'developer', 'reader'],
  'audit.export': ['owner', 'admin', 'lead'],
  'approval.grant': ['owner', 'admin', 'lead'],
};
