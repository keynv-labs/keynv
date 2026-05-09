import { describe, expect, it } from 'vitest';
import { ROLE_ALLOWS_ACTION, authorize } from './index.js';
import type { Action, AuthorizeContext, OrgRole, ProjectRole } from './index.js';

const PROJECT_ID = 'proj_demo';

function ctx(opts: {
  org: OrgRole;
  membershipRole?: ProjectRole;
  projectId?: string;
  envTier?: 'production' | 'non-production';
  requireApproval?: boolean;
  approvalGranted?: boolean;
}): AuthorizeContext {
  return {
    user: {
      org_role: opts.org,
      memberships:
        opts.membershipRole !== undefined
          ? [{ project_id: PROJECT_ID, role: opts.membershipRole }]
          : [],
    },
    resource: {
      project_id: opts.projectId ?? PROJECT_ID,
      environment_tier: opts.envTier,
      require_approval: opts.requireApproval,
    },
    approval: opts.approvalGranted !== undefined ? { granted: opts.approvalGranted } : undefined,
  };
}

describe('authorize — org-level actions', () => {
  it.each([
    ['owner', 'org.transfer', 'allow'],
    ['admin', 'org.transfer', 'deny'],
    ['developer', 'org.transfer', 'deny'],
    ['reader', 'org.transfer', 'deny'],
    ['owner', 'user.invite', 'allow'],
    ['admin', 'user.invite', 'allow'],
    ['developer', 'user.invite', 'deny'],
    ['reader', 'user.invite', 'deny'],
    ['owner', 'project.create', 'allow'],
    ['admin', 'project.create', 'allow'],
    ['developer', 'project.create', 'deny'],
    ['reader', 'project.create', 'deny'],
  ] as Array<[OrgRole, Action, 'allow' | 'deny']>)('%s + %s → %s', (orgRole, action, expected) => {
    expect(authorize(action, ctx({ org: orgRole }))).toBe(expected);
  });
});

describe('authorize — owner/admin implicit access', () => {
  it('owner is allowed every project-level action without membership', () => {
    const projectActions: Action[] = [
      'project.describe',
      'member.add',
      'secret.create',
      'secret.read',
      'secret.list_names',
      'audit.read',
      'audit.export',
      'approval.grant',
    ];
    for (const action of projectActions) {
      expect(authorize(action, ctx({ org: 'owner' }))).toBe('allow');
    }
  });

  it('admin is allowed every project-level action without membership', () => {
    const projectActions: Action[] = [
      'project.describe',
      'member.add',
      'secret.create',
      'secret.read',
      'audit.read',
    ];
    for (const action of projectActions) {
      expect(authorize(action, ctx({ org: 'admin' }))).toBe('allow');
    }
  });
});

describe('authorize — project-level actions via membership', () => {
  it('lead can manage secrets', () => {
    const c = ctx({ org: 'developer', membershipRole: 'lead' });
    expect(authorize('secret.create', c)).toBe('allow');
    expect(authorize('secret.rotate', c)).toBe('allow');
    expect(authorize('member.add', c)).toBe('allow');
    expect(authorize('approval.grant', c)).toBe('allow');
  });

  it('developer can read but not write', () => {
    const c = ctx({ org: 'developer', membershipRole: 'developer' });
    expect(authorize('secret.read', c)).toBe('allow');
    expect(authorize('secret.list_names', c)).toBe('allow');
    expect(authorize('secret.test', c)).toBe('allow');
    expect(authorize('secret.create', c)).toBe('deny');
    expect(authorize('secret.rotate', c)).toBe('deny');
    expect(authorize('member.add', c)).toBe('deny');
    expect(authorize('approval.grant', c)).toBe('deny');
  });

  it('reader can list and read audit but not resolve values', () => {
    const c = ctx({ org: 'developer', membershipRole: 'reader' });
    expect(authorize('secret.list_names', c)).toBe('allow');
    expect(authorize('audit.read', c)).toBe('allow');
    expect(authorize('secret.read', c)).toBe('deny');
    expect(authorize('secret.test', c)).toBe('deny');
    expect(authorize('audit.export', c)).toBe('deny');
  });

  it('developer with no membership is denied', () => {
    const c: AuthorizeContext = {
      user: { org_role: 'developer', memberships: [] },
      resource: { project_id: PROJECT_ID },
    };
    expect(authorize('secret.read', c)).toBe('deny');
    expect(authorize('secret.list_names', c)).toBe('deny');
    expect(authorize('audit.read', c)).toBe('deny');
  });

  it('membership on a different project does not grant access here', () => {
    const c: AuthorizeContext = {
      user: {
        org_role: 'developer',
        memberships: [{ project_id: 'proj_other', role: 'lead' }],
      },
      resource: { project_id: PROJECT_ID },
    };
    expect(authorize('secret.read', c)).toBe('deny');
  });
});

describe('authorize — production-tier approval gate', () => {
  it('developer reading prod-tier with require_approval and no approval → pending_approval', () => {
    const c = ctx({
      org: 'developer',
      membershipRole: 'developer',
      envTier: 'production',
      requireApproval: true,
    });
    expect(authorize('secret.read', c)).toBe('pending_approval');
  });

  it('developer with granted approval → allow', () => {
    const c = ctx({
      org: 'developer',
      membershipRole: 'developer',
      envTier: 'production',
      requireApproval: true,
      approvalGranted: true,
    });
    expect(authorize('secret.read', c)).toBe('allow');
  });

  it('developer with denied approval → pending_approval (not allow)', () => {
    const c = ctx({
      org: 'developer',
      membershipRole: 'developer',
      envTier: 'production',
      requireApproval: true,
      approvalGranted: false,
    });
    expect(authorize('secret.read', c)).toBe('pending_approval');
  });

  it('developer reading non-prod → allow without approval gate', () => {
    const c = ctx({
      org: 'developer',
      membershipRole: 'developer',
      envTier: 'non-production',
      requireApproval: true,
    });
    expect(authorize('secret.read', c)).toBe('allow');
  });

  it('lead reading prod-tier with require_approval → allow (leads are approvers)', () => {
    const c = ctx({
      org: 'developer',
      membershipRole: 'lead',
      envTier: 'production',
      requireApproval: true,
    });
    expect(authorize('secret.read', c)).toBe('allow');
  });

  it('admin reading prod-tier → allow (org admin bypasses approval)', () => {
    const c = ctx({
      org: 'admin',
      envTier: 'production',
      requireApproval: true,
    });
    expect(authorize('secret.read', c)).toBe('allow');
  });
});

describe('authorize — matrix consistency', () => {
  it('every action in the matrix has at least one role allowed', () => {
    for (const [action, roles] of Object.entries(ROLE_ALLOWS_ACTION)) {
      expect(roles, `${action} has no allowed roles`).not.toEqual([]);
    }
  });

  it('owner is allowed for every action that exists', () => {
    for (const action of Object.keys(ROLE_ALLOWS_ACTION) as Action[]) {
      // org.transfer / org.billing / org.kek_rotate are owner-only and always allowed
      const result = authorize(action, ctx({ org: 'owner' }));
      expect(result, `owner denied for ${action}`).not.toBe('deny');
    }
  });
});
