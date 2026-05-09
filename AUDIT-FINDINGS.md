# keynv Phase 0–3 Audit Findings

Independent pre-Phase-4 audit. Findings ordered by severity. Each item lists
the file:line and a concrete proposed fix.

## Resolution status

| ID  | Severity | Status | Closing commit | Notes |
|-----|----------|--------|---------------|-------|
| B1  | BLOCKER  | RESOLVED | "fix: close audit BLOCKERS B1 + B2" | `verifyChain` accepts `startingPrevHash`; route threads tail hash; 2 regression tests added. |
| B2  | BLOCKER  | RESOLVED | "fix: close audit BLOCKERS B1 + B2" | All project / secret / member queries now `WHERE org_id = user.org_id`; 404 on cross-org IDs (no existence disclosure). Two-org integration regression test added. |
| B3  | BLOCKER  | RESOLVED | "fix(cli): close audit BLOCKER B3" | Credentials encrypted at rest with libsodium secretbox; key lives in OS keychain via `@napi-rs/keyring`. One-shot migration drops legacy plaintext. |
| H1  | HIGH     | RESOLVED | "fix: close audit HIGHs (H1, H4, H5)" | MCP outer catch strips literal resolved value (when in scope) then runs the redactor pattern bank. |
| H2  | HIGH     | DEFERRED | — | Audit payload schema. Today's payloads are JSON-roundtrippable; tracked as Phase 5 hardening. |
| H3  | HIGH     | DEFERRED | — | Doc/code drift on JS-string lifetimes. Acknowledged in docs/05 §threats-we-don't-fully-mitigate; refactor to `Uint8Array` end-to-end is a Phase 5 hardening. |
| H4  | HIGH     | RESOLVED | "fix: close audit HIGHs (H1, H4, H5)" | Bootstrap password reads from `KEYNV_BOOTSTRAP_PASSWORD` env / stdin / argv-with-`--unsafe-allow-argv`. argv default is refused. |
| H5  | HIGH     | RESOLVED | "fix: close audit HIGHs (H1, H4, H5)" | pino logger wired into Hono `onError`; redact paths + a custom `err` serializer that runs the redactor over `Error.message` and `Error.stack`. |
| M1  | MEDIUM   | DEFERRED | — | Redactor preview length floor. Internal-only today; tighten in Phase 5. |
| M2  | MEDIUM   | DEFERRED | — | `X-Keynv-Agent` client-controlled; informational, document. |
| M3  | MEDIUM   | DEFERRED | — | Rotation grace window: doc says 1h, code is immediate. Reconcile in Phase 5. |
| M4  | MEDIUM   | DEFERRED | — | AWS-secret-key heuristic pattern. Entropy detector currently covers. |
| M5  | MEDIUM   | DEFERRED | — | `PATCH /v1/users/:id/org-role` missing. Phase 4 web UI will add it. |
| M6  | MEDIUM   | DEFERRED | — | Integrations don't expand `~`. Phase 5 polish. |

Drive-by security upgrades during this audit cycle:

- `drizzle-orm` 0.36.4 → 0.45.2 (CVE-2026-39356, HIGH; we don't use the
  vulnerable APIs but upgraded for hygiene).
- `vite` 5.x → 8.x (path traversal in optimized-deps map handler).
- `pnpm.overrides` forces `esbuild >= 0.25.0` across the dependency graph
  (esbuild dev-server origin check).
- After this cycle: **`pnpm audit` reports no known vulnerabilities**.

Test counts after this audit cycle: **197 active + 55 todo** (was 193 + 55).
Three new regression tests were added — 2 for B1 (cross-page boundary
verification, tampered-boundary detection) and 1 for B2 (two-org cross-org
access denial across project/secret/member routes).


## BLOCKERS — must fix before Phase 4

### B1. `audit verify` endpoint silently fails on chains > 1000 entries
**Where:** `apps/server/src/routes/audit.ts:53-67`
**Why it matters:** the API endpoint `POST /v1/audit/verify` paginates in
batches of 1000, calling `auditCore.verifyChain(page)` on each page in
isolation. `verifyChain` requires the first row to have `prev_hash ===
GENESIS_HASH` (`packages/core/src/audit/chain.ts:83`). The second page's
first row's `prev_hash` is the previous page's last hash, not GENESIS, so
**any audit chain larger than 1000 rows reports a false `prev_hash_mismatch`**.
The single docs/02 promise — "Audit-chain verification on a 100K-row
synthetic log" — is broken in production. The integration test passes only
because it has < 1000 rows.
**Fix:** thread the previous page's last entry into the next call. Either
(a) extend `verifyChain` to accept an optional `expectedFirstPrevHash`, or
(b) keep the previous page's last row and prepend it to the next page so
the chain check carries across the boundary. Add a 100K-row regression test
that actually loops through pages.

### B2. Cross-org data access by owner/admin (multi-tenant breach)
**Where:**
- `apps/server/src/routes/projects.ts:151-172` (GET /:id)
- `apps/server/src/routes/projects.ts:181-191` (DELETE /:id)
- `apps/server/src/routes/secrets.ts:178-267` (secret read), `269-355` (rotate),
  `358-395` (delete), `63-136` (create)
**Why it matters:** owner/admin RBAC treats project-level actions as "always
allow" regardless of `project_id`'s org. The downstream queries filter only
by `project_id` / `environment_id`. The docs (`docs/01`) state that
"multi-tenant deployments hold many" orgs. An owner of org X who knows or
guesses a project_id from org Y can read, rotate, or delete it. The audit
trail will record their actor_id, but the breach happens before audit.
**Fix:** every project- or secret-scoped query MUST be `WHERE org_id =
ctx.user.org_id AND ...`. Add `org_id` to the project loader (e.g.,
`loadProjectDek`) so it returns null for cross-org IDs. Add an integration
test where org X's owner attempts to read org Y's project and is denied.

### B3. CLI persists raw access + refresh token in plaintext JSON
**Where:** `apps/cli/src/client/store.ts:37-41`
**Why it matters:** CLAUDE.md rule #12 explicitly forbids plaintext credentials
in `~/.keynv/`. The store comments acknowledge "Phase 1 stores plain JSON
because we don't yet have an OS-keychain abstraction" and defer to a Phase-2
task that did NOT ship. Reading `~/.keynv/credentials.json` yields a
long-lived refresh token; combined with the dev's server URL, an attacker
with read-only filesystem access has a 7-day session. This **is** the agent's
own filesystem; if any tool/keynv-guard slips, the agent reads it.
**Fix:** ship the keytar / libsecret / Keychain wrapper before Phase 4. At
minimum, age-seal the credentials file with a key in the OS keychain (per
docs/05 §local-cache encryption — same mechanism is documented for the
secret cache but never built for credentials). Until shipped, mark this in
the README and audit log.

## HIGH — should fix soon

### H1. MCP `keynv.test_connection` re-throws raw exception messages
**Where:** `apps/mcp/src/server.ts:219-222`
**Why it matters:** the catch in `CallToolRequestSchema` returns
`err.message` verbatim. Most tester errors are sanitized by `sanitizeResult`
inside `runTest`, but exceptions thrown OUTSIDE `runTest` (e.g., the
`api.request<{value:string}>(...)` call at line 182, network failures,
project lookup errors) bypass sanitization. A driver-level error containing
the resolved value could surface here (e.g., a misbehaving redis client that
includes the password in a connect-error message thrown synchronously
before runTest catches it). Defense-in-depth: also `redact()` the catch's
message before returning, and replace `secret.value` literally if available.
**Fix:** wrap the entire tool body in a structured error path: keep the
resolved value in scope, and run any caught error through the same
`sanitizeResult` shape that `runTest` uses.

### H2. Audit canonicalization does not enforce a payload schema
**Where:** `packages/core/src/audit/chain.ts:9-20`,
`apps/server/src/audit/append.ts:6-11`
**Why it matters:** `AppendArgs.payload` is `Record<string, unknown>`. The
canonicalize function handles plain JSON, but anything non-JSON (`undefined`
values, Maps, Sets, Buffers, Dates passed as objects) gets a deterministic
hash that does not round-trip through JSON.parse. Two semantically distinct
payloads (e.g., `{a: new Set()}` vs `{a: {}}`) hash to the same value. The
server today only emits plain literals so it is currently safe, but there is
no static guarantee. A future contributor adding a Date or Buffer field
could introduce a hash collision without test coverage detecting it.
**Fix:** define a zod schema for `AuditInput['payload']` shape per
event_type (or at minimum a runtime check that payload is JSON-roundtrippable
in `appendAudit`). Reject non-JSON-safe inputs with a server-side throw.

### H3. `decryptSecret` returns a JS string (immutable, unzero-able)
**Where:** `packages/core/src/crypto/envelope.ts:63-69`,
`apps/server/src/routes/secrets.ts:247-266`,
`apps/cli/src/exec/resolve.ts:60-61`
**Why it matters:** `docs/05-encryption-design.md:109-111` states "We do
not keep secrets in JS strings (immutable, can't zero)." The implementation
contradicts this everywhere a secret is used. The string lifetime is the
duration of the request handler at minimum; under V8 the underlying buffer
may be deduplicated and live in heap snapshots. This is a doc/code drift
that increases the residual risk of a memory-dump leak (acknowledged in
docs/05 §threats-we-don't-fully-mitigate).
**Fix:** either update docs to match reality (acknowledge JS string
immutability is a known compromise), or refactor the value path to use
`Uint8Array` end-to-end and zero on response. The latter is invasive
(affects every consumer); the former is honest. Pick one.

### H4. Server password bootstrap accepts password on argv
**Where:** `apps/server/src/bootstrap.ts:20-26`
**Why it matters:** `parseArgs` reads `--owner-password` from `process.argv`,
which is visible to `/proc/<pid>/cmdline` under the same UID for the
bootstrap process's lifetime. Documented mitigation in docs/05 §subprocess
argv discusses this for tools, not for the server bootstrap itself.
**Fix:** read password from stdin or an env var (then unset). Refuse to
proceed if `--owner-password` is in argv unless `--unsafe-allow-argv` is set.

### H5. `app.onError` console.errors the raw err object
**Where:** `apps/server/src/app.ts:38-40`
**Why it matters:** `console.error('[keynv-server] unhandled error', err)`
prints the full Error object — message, stack, and any `cause` chain.
Library-level errors from `pg`, `mysql2`, `ioredis` etc. occasionally
embed connection-string fragments in their messages. The structured
logger (`apps/server/src/lib/logger.ts`) has correct redaction paths but
**is not wired into the app**. Logs go to stdout via console.error.
**Fix:** wire the pino logger into the Hono app (logger.error with
redacted fields), and remove the raw console.error. Add a regression test
that posts a malformed body and asserts the server log doesn't contain
known-secret-shaped patterns.

## MEDIUM / LOW — nice to have

- **M1.** `packages/redactor/src/batch.ts:12-14`: `preview()` returns the
  full matched string when its length ≤ 8. A 6-char password becomes its
  own preview. Consumed only internally today (MCP returns counts), so no
  current leak — but a future log of `match.preview` would be one. Tighten
  to always show first ≤4 chars + ellipsis, or enforce `length >= 12`
  before preview generation.
- **M2.** `apps/server/src/lib/agent.ts:9-15`: `X-Keynv-Agent` is
  client-controlled; an agent can lie about its identity in audit
  records. The actor_user_id from JWT is trustworthy, so this is a
  non-repudiation softening, not a breach. Document the trust boundary.
- **M3.** `apps/server/src/routes/secrets.ts:309-331`: rotation
  immediately marks the previous version `deleted_at`, but
  `docs/06-api-spec.md:194-195` promises "previous version retained for
  `rotation_grace_s` (default 1h)". Drift; either implement the grace
  window or amend the doc.
- **M4.** `packages/redactor/src/patterns.ts`: docs/02 §pattern-bank lists
  an "AWS secret key (heuristic)" 40-char base64 pattern; not implemented.
  Entropy detector covers the gap. Either add the pattern or remove from
  docs.
- **M5.** No `PATCH /v1/users/:id/org-role` route exists despite
  `docs/06:69-72` promising it. Drift; implement or amend doc before
  Phase 4 web UI starts depending on the docs.
- **M6.** `packages/integrations/src/file-deny-list.ts:24-27`: paths like
  `.aws/credentials` won't match the user's home (`~/.aws/credentials`)
  unless integrations expand them. Each integration's own pattern syntax
  should be tested for that.

## CONFIRMED OK — load-bearing primitives

- **Crypto envelope** (`packages/core/src/crypto/envelope.ts`): wrap/unwrap
  + encrypt/decrypt use `crypto_secretbox_easy` (XSalsa20-Poly1305) with
  fresh 24-byte random nonces from libsodium's CSPRNG every call. Length
  preconditions throw on misuse. Tampered ciphertext / wrong key / wrong
  nonce all raise auth errors. Property tests roundtrip arbitrary inputs.
  No nonce reuse risk for randomly-drawn 24-byte nonces under
  XSalsa20-Poly1305 (collision probability ~2^-96 per write).
- **Audit chain core algorithm** (`packages/core/src/audit/chain.ts`):
  `verifyChain` correctly catches tampering (modify, delete, reorder,
  insert) when a complete chain is passed. Genesis-hash convention is
  consistent. `computeHash` is order-stable for object keys. The only
  flaw is at the API surface (B1, H2), not the algorithm itself.
- **RBAC `authorize`** (`packages/rbac/src/authorize.ts`): single
  chokepoint, matrix-driven, owner/admin implicit allow, developer
  production-tier approval gating implemented per docs/04. Test coverage
  exhaustive across roles × actions × tier combinations. Every protected
  server route does call it; verified by inspection (auth, projects,
  secrets, members, users, audit).
- **`keynv exec` privileged subprocess** (`apps/cli/src/exec/spawn.ts`):
  curated `ENV_ALLOWLIST` is restrictive (PATH/HOME/USER/SHELL/TERM/LANG/
  LC_*/TZ/PWD/TMPDIR/SSH_AUTH_SOCK only); caller env is not inherited.
  Subprocess stdout/stderr piped through `createRedactStream`, with
  resolved values fed as `literals` to the redactor as belt-and-suspenders.
  argv tradeoff documented in docs/05.
- **MCP reference token** (`apps/mcp/src/tokens.ts`): single-use, 60s TTL,
  in-memory store, eviction timer with `.unref()`. `keynv.use_secret`
  never returns the value. `keynv.list_secrets` and `keynv.who_am_i` are
  metadata-only. `keynv.redact_text` returns counts only. The only
  value-touching path is `keynv.test_connection`, which goes through the
  3-layer sanitizer (per-tester, runner, redactor) — see H1 for the
  remaining gap.
- **Argon2id parameters** (`apps/server/src/auth/password.ts`): m=19456
  KiB / t=2 / p=1 matches OWASP "Argon2id minimum profile (m=19MB)".
  Reasonable for 2026 server hardware. The dummy-hash trick in
  `apps/server/src/routes/auth.ts:48-50` is correctly tight: same
  argon2.verify is called whether the user exists or not.
- **JWT + refresh token** (`apps/server/src/auth/jwt.ts` + `tokens.ts`):
  HS256 with the env-supplied secret (≥32 chars enforced); refresh
  tokens are 32 random bytes, stored as SHA-256, rotated on each refresh,
  revoked on logout. Solid.

## DRIFT — docs vs code

| Doc claim | Code reality |
|---|---|
| `docs/05:109-111` "We do not keep secrets in JS strings" | Strings end-to-end (H3) |
| `docs/06:194-195` "previous version retained for rotation_grace_s" | Immediate `deleted_at` on rotate (M3) |
| `docs/06:69-72` `PATCH /v1/users/:id/org-role` | Not implemented (M5) |
| `docs/02 pattern-bank` lists "AWS secret key (heuristic)" | Not in `patterns.ts` (M4) |
| `CLAUDE.md rule 12` "Never store credentials in `~/.keynv/` plaintext" | `credentials.json` is plain JSON (B3) |
| `docs/01` "multi-tenant deployments hold many [orgs]" | Project/secret routes leak across orgs (B2) |
| `docs/05:131` "100K-row synthetic chain verifies" | API endpoint breaks at >1000 rows (B1) |

## Bottom line

The core primitives — crypto, RBAC matrix, audit hash algorithm, exec env
filtering, MCP token semantics — are sound. The drift is concentrated in
the seams between primitives: pagination around the audit chain, org_id
scoping around RBAC checks, and persistence around credentials. **These
are exactly the seams Phase 4 will lean on**, so fixing B1/B2/B3 before
the web UI inherits the pattern is the right call.
