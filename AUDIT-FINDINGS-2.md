# keynv Phase 4–5 Post-Audit Findings

Follow-up audit cycle performed after `AUDIT-FINDINGS.md` closed all 14
original findings (3 BLOCKER / 5 HIGH / 6 MEDIUM). Three parallel
review streams (server + crypto + audit; CLI + MCP + redactor + testers;
web + tests + CI + deploy) re-walked the codebase looking for **new**
issues introduced during Phase 4 (web UI slices 8–11) and Phase 5
hardening seams, plus regressions on the original findings.

All 14 original findings (B1, B2, B3, H1–H5, M1–M6) remain RESOLVED
with no observed regressions. The load-bearing primitives are still
sound: crypto envelope, RBAC matrix, audit chain algorithm, exec env
filter, MCP token semantics.

## Resolution status

| ID  | Severity | Status   | Closing commit                                                                | Notes |
|-----|----------|----------|-------------------------------------------------------------------------------|-------|
| H1  | HIGH     | RESOLVED | `fix(web): block open-redirect via next param in login/register`              | `safeNext()` helper combines a strict prefix check with `URL`-origin guard; login + register thread through it. |
| H2  | HIGH     | RESOLVED | `fix(web): require CSRF on dismissOnboardingAction`                           | Dismiss action now takes the CSRF token via the existing `useCsrfToken()` hook; silent reject on missing/forged token. |
| H3  | HIGH     | RESOLVED | `fix(server): scope GET /v1/projects developer path to caller's org`          | Non-admin path scopes by `org_id` in SQL; membership filter stays as defence-in-depth. |
| H4  | HIGH     | RESOLVED | `fix(server): close approvals TOCTOU with partial unique index`               | Migration 0008 + `INSERT ... ON CONFLICT DO NOTHING`; partial UNIQUE on `(project_id, alias, requester_user_id) WHERE status='pending'`. |
| H5  | HIGH     | RESOLVED | `fix(server): scope user role/delete mutations to caller's org`               | PATCH/DELETE `WHERE` now include `org_id` alongside `id`. |
| H6  | HIGH     | RESOLVED | `fix(core): allow org_id on user.invited audit payload`                       | Discovered while writing H3 regression test — admin invite was 500'ing in production because the audit schema rejected the route's extra `org_id` key. |
| M1  | MEDIUM   | RESOLVED | `fix(web): drop unsafe-eval from production CSP`                              | `'unsafe-eval'` gone from production script-src; `'unsafe-inline'` deferred (needs nonce middleware — tracked below). |
| M2  | MEDIUM   | RESOLVED | `fix(web): sunset legacy v1 session cookies + add HSTS`                       | `SESSION_V1_SUNSET_MS = 2026-07-01T00:00:00Z`; v1 cookies rejected after that date. HSTS `max-age=31536000; includeSubDomains` in production. |
| M3  | MEDIUM   | RESOLVED | `fix(cli): mask secret values in keynv init TUI checklist`                    | `maskedPreview()` shows only `[••••] (hint, N chars, fp:XXXX)`; alias literals still use `previewValue` since they're safe to display. |
| M4  | MEDIUM   | RESOLVED | `test(e2e): add CSRF rejection + security-headers specs`                      | Two new Playwright specs: CSRF stripping on the register form, plus header invariants on every public page. |

**Final state**: All 10 new findings resolved.

## HIGH — must fix before next release

### H1. Open redirect in `next` query parameter (login + register)
**Where:**
- `apps/web/app/login/_actions/actions.ts:56` (pre-fix)
- `apps/web/app/register/_actions/actions.ts:77` (pre-fix)

**Why it matters:** the post-login redirect target was filtered by
`parsed.data.next?.startsWith('/')`. That check accepts
`//attacker.com` (protocol-relative URL — the browser treats the
authority after `//` as a fully qualified host) and `/\evil.com`
(backslash variant — browsers normalise `\` to `/` after a leading
`/`). Next.js `redirect()` emits the value verbatim into the
`Location` header, taking a freshly-authenticated user off-origin.
Classic phishing primitive.

**Fix:** `apps/web/lib/safe-next.ts` exports `safeNext(value, fallback)`
combining (a) a `startsWith('//') || startsWith('/\\')` rejection,
(b) a C0/DEL header-injection filter, and (c) a `new URL(value, base)`
origin-stability check as defence in depth. Both action files route
their redirect target through it. Nine unit cases cover the happy
path, every blocked variant, and a custom-fallback path.

### H2. `dismissOnboardingAction` had no CSRF guard
**Where:** `apps/server/src/db/migrations/.../apps/web/app/(authed)/actions.ts:8-14` (pre-fix)

**Why it matters:** every other server action in
`app/(authed)/actions.ts` validates CSRF (`requireCsrf` or
`requireCsrfToken`) before mutating state. The dismiss action was a
fire-and-forget `POST /v1/onboarding/dismiss` with no guard, so any
page on another origin could silently dismiss the user's onboarding
checklist by tricking the user into a request. Low business impact
(only the onboarding flag is affected) but a real CSRF bypass that
contradicts the recent rc.17 hardening posture.

**Fix:** signature now takes `csrfToken?: string | null`, validated
with the existing `requireCsrfToken` helper. Silent return on
missing/forged tokens since the action is intentionally
fire-and-forget — there's no UI surface to error to, and the
protective outcome (onboarding stays visible) is the right default.
Three unit tests cover null / forged / valid token paths.

### H3. `GET /v1/projects` developer path loaded every org's projects
**Where:** `apps/server/src/routes/projects.ts:102-109` (pre-fix)

**Why it matters:** the admin path of the same handler correctly
filters by `org_id`. The non-admin developer path did
`select().from(projects).where(isNull(deleted_at))` with no `org_id`
scope, then filtered in JS by membership. On a multi-tenant
deployment that pulls every org's project metadata into the Node
heap before the in-memory filter runs — a side-channel cross-org
disclosure (process memory dumps, heap snapshots, OOM crash logs)
and a perf regression that scales with database size rather than
org size.

**Fix:** one-line addition of `eq(schema.projects.org_id,
user.org_id)` to the `WHERE` so the database does the scoping. The
membership filter stays as belt-and-suspenders. The B2 cross-org
regression suite gains a new test where a developer in org A only
ever sees org-A projects, even when org B has any number of
projects.

### H4. Approvals TOCTOU — duplicate pending rows under concurrent reads
**Where:** `apps/server/src/routes/approvals.ts:347-376` (pre-fix);
no constraint in `apps/server/src/db/migrations/0003_approvals.sql`.

**Why it matters:** `ensurePendingApproval` did a SELECT for an
existing pending row, then unconditionally INSERTed if none was
found. Two parallel reads of the same `require_approval` secret by
the same developer (e.g., `keynv exec --` re-runs in quick
succession, or the agent retrying after a transient error) could
both pass the existence check and both insert, doubling the lead's
queue. Idempotency was promised in the function's docstring; the
implementation was racy.

**Fix:** new migration `0008_approvals_unique_pending.sql` first
dedupes any pre-existing duplicates (`MIN(rowid)` per
`(project_id, alias, requester_user_id)` group wins) and creates a
partial UNIQUE index `WHERE status = 'pending'`. The function
switches to `INSERT … ON CONFLICT DO NOTHING … RETURNING`, and on
conflict re-reads the winning row so all callers receive the same
id. Regression test fires 8 parallel calls and asserts exactly one
pending row, one creator, one shared id.

### H5. PATCH/DELETE user mutation `WHERE` missing `org_id`
**Where:**
- `apps/server/src/routes/users.ts:163` (PATCH `/v1/users/:id/org-role`, pre-fix)
- `apps/server/src/routes/users.ts:193` (DELETE `/v1/users/:id`, pre-fix)

**Why it matters:** both endpoints correctly scope the preceding
SELECT to `(id, org_id)`, but the mutation itself only filters by
`id`. No current code path moves users between orgs, so the
exploit is currently theoretical — but the missing `WHERE`
column is exactly the seam future contributors trip on, and the
defensive habit established in the B2 fix shouldn't have an
exception here.

**Fix:** add `eq(schema.users.org_id, user.org_id)` to both
mutations' `WHERE`. New regression test in the B2 suite has owner B
attempt to PATCH and DELETE a user that belongs to org A — both
must return 404, and owner A confirms the dev row is intact.

### H6. `user.invited` audit payload rejected by strict schema
**Where:**
- `packages/core/src/audit/payload-schemas.ts:43` (pre-fix)
- `apps/server/src/routes/users.ts:122-127` always sends `org_id`

**Why it matters:** discovered while writing the H3 regression test
(`POST /v1/users` returned 500 instead of 201). The route always
sends `org_id` in the audit payload (added when cross-org invites
shipped) but the payload schema is `.strict()` without `org_id`, so
the audit append throws after the user row has already been
inserted — split-brain state (the user exists but the audit chain
has no record) and broken UX (caller sees 500). Production-impacting
regression that had no test coverage because no existing test
exercised `POST /v1/users`.

**Fix:** add `org_id: orgId` to the `'user.invited'` schema (matches
the established pattern in `'auth.register'`). Happy-path test
extended.

## MEDIUM — should fix soon

### M1. Production CSP carried both `'unsafe-eval'` and `'unsafe-inline'`
**Where:** `apps/web/next.config.ts:23` (pre-fix)

**Why it matters:** the combination negates the XSS mitigation value
of CSP — inline payloads run unchecked, and any DOM-based eval
gadget bypasses nonce/hash filtering. Next.js 15 + React 19 in
production does not require `'unsafe-eval'` (it was leftover from
dev-time React Refresh), so drop it. `'unsafe-inline'` for scripts
is a harder problem because Next inlines a small bootstrap script
for hydration; cleanly replacing it requires a per-request nonce
middleware and is filed as a follow-up.

**Fix:** extract the headers list into `apps/web/lib/security-headers.ts`
where it's unit-testable; production drops `'unsafe-eval'`, dev keeps
it. Nine new unit cases cover production vs development variants and
the foundational directives.

### M2. Legacy v1 session cookies accepted indefinitely, no HSTS header
**Where:**
- `apps/web/lib/session.ts:82-90` (pre-fix `decodeSession`)
- `apps/web/next.config.ts` (no HSTS header pre-fix)

**Why it matters:** rc.17 introduced v2 (AES-256-GCM) session
cookies but kept accepting v1 (HMAC-only, no confidentiality)
cookies forever. There was no operational path to retire v1, so the
weaker format would have been with us in perpetuity. Separately, no
`Strict-Transport-Security` header meant the browser had no signal
to upgrade HTTP → HTTPS automatically after the first visit.

**Fix:** add `SESSION_V1_SUNSET_MS = 2026-07-01T00:00:00Z` constant.
`decodeSession` accepts a `now` parameter (defaults to `Date.now()`)
and returns null for v1 cookies once `now >= SESSION_V1_SUNSET_MS`
— the worst case is a single forced re-login. HSTS emitted in
production only (`max-age=31536000; includeSubDomains`); internal
HTTP-only deployments can override upstream. Unit tests cover
before/after sunset and HSTS presence/absence per environment.

### M3. `keynv init` TUI rendered 27 chars of every secret value
**Where:**
- `apps/cli/src/init/heuristics.ts:198-202` (`previewValue` — fine for
  alias literals)
- `apps/cli/src/ui/flows/init.ts:261` (caller for non-alias values, pre-fix)

**Why it matters:** the multiselect checklist line for each
discovered secret used `previewValue(r.value, 28)`, which truncates
to the first 27 chars + ellipsis. For SDK keys like `sk_live_…`,
`ghp_…`, `sk-…` that's nearly the entire key — and the TUI sits on
screen for as long as the user is reviewing. Screencasts, screen
shares, scrollback buffers, and even certain accessibility tools
all capture this. `AGENTS.md` hard rule #1 ("never print resolved
secret values to chat / terminal / log / file") explicitly applies
to our own UI.

**Fix:** new `maskedPreview(value, hint)` returns
`[••••] (hint, N chars, fp:XXXX)` — the four-hex fingerprint is the
first four chars of SHA-256, enough for visual deduplication while
leaving the full key cryptographically infeasible to recover from
the prefix. Alias literals (safe to show) still use `previewValue`.
The unit suite asserts that no four-char substring of a
high-entropy input ever appears in the masked label, plus
stability/divergence properties of the fingerprint.

### M4. E2E suite missed CSRF rejection + security-header invariants
**Where:** `tests/e2e/tests/` (227 lines across 4 specs, none for
the post-rc.17 security surface)

**Why it matters:** every mutating server action validates CSRF, but
no end-to-end test verified the rejection path. A future regression
(e.g., the helper returning a falsy short-circuit on the wrong
branch) would land without a CI signal. Same for the security
headers added in rc.17 and this cycle — unit tests of
`securityHeaders()` only cover the function in isolation, not the
fact that Next is wired to emit them on every response.

**Fix:** two new Playwright specs:
- `csrf.spec.ts` — opens `/register`, strips the CSRF input via
  `page.evaluate`, asserts the action returns the "Security check
  failed" surface without hitting the backend. Bonus assertion on
  `/login` that the CSRF token renders in the expected
  `base64url.signature` shape.
- `security-headers.spec.ts` — fetches `/login` headers and asserts
  every foundational header is present with the expected value;
  asserts CSP `unsafe-eval` is absent in production (gated by
  `NODE_ENV` because `next dev` allows it).

E2E `tsconfig.json` gains `"lib": ["ES2022", "DOM"]` so
`page.evaluate` callbacks can reference `document` without a
per-call cast.

## CONFIRMED OK — verified during this cycle

- **Crypto envelope** (`packages/core/src/crypto/envelope.ts`) — no
  changes since the original audit; primitives still sound.
- **Audit chain algorithm** (`packages/core/src/audit/chain.ts`) —
  hash computation order-stable, `verifyChain` still catches
  modify/delete/reorder/insert.
- **RBAC `authorize`** (`packages/rbac/src/authorize.ts`) — single
  chokepoint, matrix-driven, exhaustively tested.
- **CSRF helper** (`apps/web/lib/csrf.ts`) — every `'use server'`
  exported mutator in `apps/web/app/**/_actions/*.ts` calls
  `requireCsrf`/`requireCsrfToken`; the only gap was H2 (closed).
- **Session sealing** (`apps/web/lib/session.ts`) — AES-256-GCM seal
  + 12-byte random nonce + auth tag; v1 fallback now sunset (M2).
- **`keynv exec` privileged subprocess** — env allowlist still
  restrictive; stdout/stderr piped through `createRedactStream`;
  resolved values still fed as literals.
- **MCP reference token** (`apps/mcp/src/tokens.ts`) — single-use,
  60s TTL, in-memory; H1 sanitizer still wired correctly.
- **Argon2id parameters** (`apps/server/src/auth/password.ts`) —
  unchanged, still OWASP-aligned.
- **JWT + refresh token rotation** — unchanged.

## DRIFT — docs vs code

None of the previous drift items (`docs/05`, `docs/06`, `CLAUDE.md
rule 12`, `docs/01`, `docs/02`) regressed during this cycle. The
fixes above did not introduce new drift either.

## Out of scope — deferred LOW items for the next cycle

Tracked here so the next reviewer can pick up cold and so the
overall hardening backlog stays visible.

- **L1.** MCP `keynv.use_secret` has no per-user/per-source
  token-issuance rate limit (`apps/mcp/src/server.ts:160-167`).
  Burst issuance only DoSes the local agent's process, so the
  exposure is bounded — but adding a sliding window would be
  belt-and-suspenders.
- **L2.** CLI top-level `process.on('unhandledRejection', …)` not
  installed (`apps/cli/src/index.ts:91-98`). Fire-and-forget
  rejections in imported modules can escape the `main().catch()`.
- **L3.** CodeQL workflow doesn't upload SARIF to the GitHub
  Security tab and has no PR comment integration
  (`.github/workflows/security.yml:33-41`). Findings sit silently
  in the action log.
- **L4.** Dockerfile base images aren't digest-pinned
  (`apps/server/Dockerfile:14,48`). Tag drift can swap the
  underlying image without code review.
- **L5.** CLI browser-auth callback doesn't restrict HTTP URLs to
  loopback (`apps/cli/src/client/browser-auth.ts:48-59`). HTTPS for
  any host is allowed (standard for device-code flows), but raw
  HTTP for `example.com` would currently open.
- **L6.** Litestream sidecar in `deploy/docker-compose.yml` has no
  healthcheck.
- **L7.** `useExhaustiveDependencies` biome-ignore in
  `apps/web/components/layout/mobile-top-bar.tsx:15` could be
  refactored away.
- **L8.** Production CSP still includes `'unsafe-inline'` on
  `script-src` because Next inlines hydration bootstrap. Replacing
  with a per-request nonce middleware would let us drop the last
  CSP escape hatch.

## Bottom line

The drift this round is concentrated in the seams between the
recent rc.17 hardening work (CSP, CSRF, session sealing) and the
older Phase 4 routes (projects list, approvals state machine, user
mutations, audit payload schemas). Same pattern as the previous
cycle: the primitives are sound, the seams need tightening. With
this round closed, the next pass can focus on the deferred LOW items
above and the CSP nonce middleware.
