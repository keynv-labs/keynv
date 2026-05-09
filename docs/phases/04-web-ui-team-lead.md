# Phase 4 — Web UI for Team Leads

**Duration estimate**: 3–4 weeks (full-time, solo). **Post-MVP**.

**Goal**: Give team leads a click-based admin experience. Phases 1–3 are CLI-only and that's enough for ship; Phase 4 broadens reach so non-technical leads can manage projects, members, audit, and approvals.

**Status**: blocked on Phase 3.

---

## Scope

Next.js 15 (App Router) dashboard living in `apps/web/`. Server-rendered, session-cookie auth. Same backend as the CLI — no parallel API.

Out of scope:

- Mobile app (Phase 6+).
- Real-time push (websockets/SSE) — Phase 4 polls; Phase 6 may add WS.
- Plugin/marketplace UI for community testers — Phase 6.

## Pages & flows

### `/login`
Email + password. After login, server sets a session cookie and a CSRF token. Refresh tokens still hashed at rest.

### `/projects`
List of projects the user can see. Create-project button (Owner/Admin only). Each project card shows: secret count, member count, environments with health summary (green/yellow/red badge per environment).

### `/projects/[id]`
Project overview: environments, recent audit, health summary.

### `/projects/[id]/secrets`
Table of secrets in the project, filterable by environment.

Columns: alias, version, last rotated, last accessed by, last test result.

Actions per row: rotate (modal with `--via-stdin` style upload), delete, view audit, run test.

**Critical UX rule**: there is no UI affordance to display a secret value. Even Owner/Admin cannot see values in the UI; if they need them they use the CLI (which audits the read). The web UI is for managing references and metadata, never values.

### `/projects/[id]/members`
Membership table. Add/remove/role-change actions. Role-change requires confirmation modal noting the audit trail.

### `/projects/[id]/audit`
Filterable audit log: by actor, time range, event type, alias. Hash-chain integrity badge ("verified ✓ as of timestamp"). Export to CSV/JSON button.

### `/projects/[id]/status`
Connection-test board. One card per registered tester showing last 24h status timeline. Click to run a test now.

### `/projects/[id]/approvals`
Pending production-access requests. Lead/Admin can grant or deny with a comment; comments are part of the audit chain.

### `/settings/account`
User profile, password change, MFA enrollment (Phase 5+ to ship full TOTP), CLI tokens.

### `/settings/account/cli-tokens`
Issue/revoke long-lived CLI tokens for headless use. Each token has scopes (read-only, project-bound, etc). Token shown once on creation, never re-displayed.

### `/admin/users` (Owner/Admin)
Org-level user management: invite, role-change, remove. Bulk operations.

### `/admin/audit/verify`
Run audit-chain verification across the org. Background job; surfaces last verification time.

### `/admin/kek-rotate` (Owner only)
Guided KEK-rotation flow with explicit "this will lock the system briefly" warning, confirmation, and post-rotation verification.

## Stack

- Next.js 15 (App Router, Server Components by default).
- Tailwind 4 + shadcn/ui components.
- Auth: session-cookie based; server-side validation against keynv-server using its `/v1/auth/*` endpoints.
- Form validation: react-hook-form + zod (same schemas as the API).
- Data fetching: server components for reads; server actions for writes.
- Tests: Playwright for end-to-end, vitest + Testing Library for component.

## Server-action proxy pattern

Web UI mostly proxies to keynv-server's REST API. Auth is end-to-end:

```
Browser  -- session cookie --> Next.js (server action / RSC)
                                  |
                                  | derive short-lived JWT from session
                                  v
                              keynv-server REST API
```

Web UI does not have its own DB.

## Acceptance criteria

End-to-end flow:

1. Lead opens browser, logs in.
2. Creates project "billing" with envs `dev` and `prod`. Marks `prod` as `require_approval`.
3. Adds developer alice@team.com.
4. Creates secret `@billing.dev.db_url` via the upload modal (value stays in browser memory only during submit, never logged).
5. Goes to `/audit` — sees the project.create, member.add, secret.create entries.
6. Sees `verified ✓` chain badge.
7. From a separate device, alice runs `keynv exec --` against the secret — lead sees the access in the audit log within polling interval (≤ 10 s).
8. Alice tries to read `@billing.prod.db_pass` — gets pending-approval. Lead sees a notification on `/approvals`, clicks Grant. Alice's CLI proceeds.

And:
- Lighthouse perf score ≥ 90 on `/projects` and `/projects/[id]/secrets`.
- Playwright suite covers all flows above.
- No client component handles a plaintext secret value (audited via lint rule + manual review).
- A11y: passes axe-core audit on every page.

## Risks specific to Phase 4

| Risk | Mitigation |
|---|---|
| UI accidentally exposes a plaintext value (e.g., in network response visible to dev tools) | Backend never returns plaintext to web UI; secrets cannot be read through UI. Lint rule blocks any `?value=` query against secret endpoints from web. |
| Session-cookie hijack | HttpOnly + Secure + SameSite=Strict cookies. Short session TTL with idle refresh. |
| CSRF on server actions | Next.js server actions are CSRF-protected; verify per the docs. |
| Render-time mistakes leak data | Audit-log payloads are scrubbed of any value-shaped string before rendering; integration tests assert this. |
| Polling load on backend | Default poll interval 30 s; backoff on idle tabs; cache headers on read endpoints. |

## Hand-off to Phase 5

Phase 5 (hardening) starts with:
- A real UI surface to perform the security audit against.
- Documentation for both CLI and web flows.
- Telemetry hooks (optional, opt-in) to feed a future SIEM.
