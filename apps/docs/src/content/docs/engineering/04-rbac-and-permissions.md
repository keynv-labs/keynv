---
title: 04 — RBAC and Permissions
sidebar:
  order: 04
---


## Roles

Five roles. They are intentionally few: more roles invite confusion and "let me just give them admin" decisions. Custom roles are a Phase 6 commercial feature.

| Role | Scope | Summary |
|---|---|---|
| **Owner** | Org-wide | One per org. Bills the account, controls the master KEK, transfers ownership. |
| **Admin** | Org-wide | Manages projects and users. Cannot remove the Owner. |
| **Team Lead** | Per-project | Creates / edits secrets, manages members of their projects, approves prod-tier reads. |
| **Developer** | Per-project | Reads secrets, runs `keynv exec`, runs connection tests. Cannot create/edit/rotate. |
| **Reader** | Per-project | Lists secrets (alias names only) and reads audit log. Cannot resolve any value. |

A user holds **one org role** (default: developer) plus zero-or-more **per-project memberships** that override the default for that project.

## Permission matrix

| Action | Owner | Admin | Lead | Developer | Reader |
|---|---|---|---|---|---|
| `org.transfer` | ✓ | | | | |
| `org.billing` | ✓ | | | | |
| `org.kek_rotate` | ✓ | | | | |
| `user.invite` | ✓ | ✓ | | | |
| `user.remove` | ✓ | ✓ | | | |
| `user.role_change` | ✓ | ✓ | | | |
| `project.create` | ✓ | ✓ | | | |
| `project.delete` | ✓ | ✓ | | | |
| `project.describe` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `member.add` | ✓ | ✓ | ✓¹ | | |
| `member.remove` | ✓ | ✓ | ✓¹ | | |
| `secret.create` | ✓ | ✓ | ✓ | | |
| `secret.update` | ✓ | ✓ | ✓ | | |
| `secret.delete` | ✓ | ✓ | ✓ | | |
| `secret.rotate` | ✓ | ✓ | ✓ | | |
| `secret.read` | ✓ | ✓ | ✓ | ✓² | |
| `secret.list_names` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `secret.test` (Phase 3) | ✓ | ✓ | ✓ | ✓ | |
| `audit.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `audit.export` | ✓ | ✓ | ✓ | | |
| `approval.grant` (Phase 4) | ✓ | ✓ | ✓ | | |

¹ Lead can manage members **only on their own projects**.
² Developer reads are subject to environment-tier policy: production-tier secrets may require approval (Phase 4). MVP allows configurable per-environment "require_approval" flag stored on the project; if set, developer reads return a pending-approval error.

## Resolution algorithm (server-side)

```ts
function authorize(user: User, action: Action, ctx: ResourceContext): "allow" | "deny" {
  // 1. Org-level actions check user's org role only.
  if (action.startsWith("org.") || action === "user.invite" || action === "user.remove"
      || action === "user.role_change" || action === "project.create"
      || action === "project.delete") {
    return user.orgRole === "owner" || user.orgRole === "admin"
      ? "allow" : "deny";
  }

  // 2. Project-level: check membership.
  const membership = ctx.projectId
    ? user.memberships.find(m => m.projectId === ctx.projectId)
    : null;
  const effectiveRole = membership?.role ?? user.orgRole;

  // 3. Owner/Admin always allowed for project-level actions.
  if (effectiveRole === "owner" || effectiveRole === "admin") return "allow";

  // 4. Lookup in matrix.
  const allowed = MATRIX[action]?.includes(effectiveRole) ?? false;
  if (!allowed) return "deny";

  // 5. Environment-tier policy.
  if (action === "secret.read" && ctx.environmentTier === "production"
      && ctx.requireApproval && effectiveRole === "developer") {
    return ctx.approvalGranted ? "allow" : "deny";
  }

  return "allow";
}
```

Every check passes through this single function. Bypassing it for any reason is a code-review blocker.

## Approval workflow (Phase 4)

For environments marked `require_approval = true`:

1. Developer attempts `keynv secret get @x.prod.y` → server returns `403 PendingApproval` with a request id.
2. CLI prints: "Production access requires approval. Request ID: req-abc123. Notifying leads..."
3. Server pings configured webhook (Slack, email, custom) with request payload.
4. Lead reviews in web UI (Phase 4) and approves/denies. Approval is short-lived (default 30 min).
5. Developer's CLI polls or receives push (Phase 4) and resolves.

For Phase 1–3 (CLI-only MVP), approvals are limited to a CLI command (`keynv approve req-abc123` / `keynv deny req-abc123`) executed by a lead from the same machine or via SSH. The full webhook workflow ships in Phase 4.

For Phase 6 commercial: multi-step (M-of-N) approvals.

## Membership model

```sql
memberships(
  user_id    TEXT NOT NULL,
  project_id TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('lead', 'developer', 'reader')),
  granted_by TEXT NOT NULL,       -- user_id of granter
  granted_at TEXT NOT NULL,
  expires_at TEXT,                -- optional; nullable
  PRIMARY KEY (user_id, project_id)
)
```

Org Owner/Admin do not need explicit memberships — they have implicit access to all projects.

A user can hold different roles on different projects: lead on `billing`, developer on `auth`, reader on `legacy`. Their effective role per project is whichever the membership says (or org-role for Owner/Admin).

## Onboarding default

When a new user joins the org via invite:

- Default org role: `developer`
- Default project memberships: none

The Admin who invited them must explicitly grant project memberships. This avoids the "everyone has access to everything" failure mode common in early-stage teams.

## Auditable events

Every permission-relevant action emits an audit record:

- `secret.read.allowed` / `secret.read.denied`
- `secret.create`, `secret.update`, `secret.delete`, `secret.rotate`
- `member.add`, `member.remove`, `member.role_change`
- `project.create`, `project.delete`
- `approval.requested`, `approval.granted`, `approval.denied`, `approval.expired`
- `kek.rotated`

Denied actions are audited with the same care as allowed ones — denial events are signal for both anomaly detection and "your dev tried to read prod" workflows.

## Anti-patterns we explicitly reject

- **"Just put everyone in `admin` and trust them"** — lazy. The Developer/Reader split exists precisely so junior teammates don't accidentally exfiltrate prod via a mis-clicked command.
- **"Use ABAC / policy DSL like Cedar"** — premature complexity for 3–15-person teams. RBAC matrix is the entire surface. A custom-role / policy-DSL feature can come later in Phase 6.
- **"Skip auditing for read-only reader role"** — no. Every meaningful action is audited.
- **"Time-bound role grants"** — useful but not MVP. Membership `expires_at` exists in the schema but not yet exposed in CLI/UI; we'll wire it in Phase 4.
