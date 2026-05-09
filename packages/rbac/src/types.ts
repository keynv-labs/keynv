/**
 * The role a user holds at the organization level. Every user has
 * exactly one org role; `developer` is the default for new invitees.
 *
 * Note: `lead` is intentionally absent here — lead is always project-
 * scoped (set via membership, not as an org role).
 */
export type OrgRole = 'owner' | 'admin' | 'developer' | 'reader';

/**
 * The role a user holds on a specific project. A user can hold
 * different project roles on different projects.
 */
export type ProjectRole = 'lead' | 'developer' | 'reader';

/**
 * Either kind of role. Used by the authorization matrix.
 */
export type Role = OrgRole | ProjectRole;

/**
 * Closed set of authorization actions. Adding a new action here is a
 * deliberate choice: extend the matrix in `matrix.ts`, then call
 * `authorize` at the route handler.
 */
export type Action =
  // Org-level
  | 'org.transfer'
  | 'org.billing'
  | 'org.kek_rotate'
  | 'user.invite'
  | 'user.remove'
  | 'user.role_change'
  | 'project.create'
  | 'project.delete'
  // Project-level
  | 'project.describe'
  | 'member.add'
  | 'member.remove'
  | 'member.role_change'
  | 'secret.create'
  | 'secret.update'
  | 'secret.delete'
  | 'secret.rotate'
  | 'secret.read'
  | 'secret.list_names'
  | 'secret.test'
  | 'audit.read'
  | 'audit.export'
  | 'approval.grant';

/**
 * Indicates which environment tier a resource lives in. Production-tier
 * resources may require approval for non-admin reads.
 */
export type EnvironmentTier = 'production' | 'non-production';

export interface Membership {
  readonly project_id: string;
  readonly role: ProjectRole;
}

export interface AuthorizeContext {
  readonly user: {
    readonly org_role: OrgRole;
    readonly memberships: ReadonlyArray<Membership>;
  };
  readonly resource?: {
    readonly project_id?: string | undefined;
    readonly environment_tier?: EnvironmentTier | undefined;
    readonly require_approval?: boolean | undefined;
  };
  readonly approval?:
    | {
        readonly granted: boolean;
      }
    | undefined;
}

/**
 * The decision returned by `authorize`. `pending_approval` is a soft
 * deny that the API surfaces as `202 PendingApproval` so the caller
 * can request a lead's sign-off.
 */
export type Decision = 'allow' | 'deny' | 'pending_approval';
