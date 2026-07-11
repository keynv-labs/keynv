# Changelog

All notable changes to keynv will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> [!NOTE]
> keynv is in pre-1.0. Minor versions (`0.x.0`) may include breaking schema or
> API changes; patch versions (`0.x.y`) are backwards-compatible. The full
> stability promise lands at `1.0.0`. See [`CONTRIBUTING.md`](./CONTRIBUTING.md#deprecation-policy).

## [Unreleased]

## [0.1.0-rc.23] — 2026-07-11

The **vault-first** release. keynv leads as a self-hosted secrets vault for
teams and AI-assisted development — store secrets, reference them by alias
(`@project.env.key`), and run your app normally while the real values stay out
of your code, shell history, and AI transcripts. The local leak-scrubbing tools
(`doctor` / `scrub` / `watch`) become a secondary "clean up existing leaks"
layer. Self-hosting is now a single-command deploy, and the hosted keynv.dev
path is first-class.

### Added
- **Single-command self-host** — the server boots with **zero** required env
  vars: the JWT secret, master/KEK, and web session secret are all generated and
  persisted to `/data` on first start (`lib/jwt-secret.ts`, `kek/load.ts`,
  `web/lib/session-secret.ts`). The only values an operator sets are
  `KEYNV_BOOTSTRAP_OWNER_EMAIL` + `KEYNV_BOOTSTRAP_OWNER_PASSWORD`, and
  missing/short values only warn instead of crash-looping. One Coolify resource
  runs both the server and the panel; litestream backup moved behind a `backup`
  compose profile so `up` works with no S3.
- **Hosted keynv.dev is first-class** — `/login` shows a capability-gated
  "Create account" link (hosted instances only) that carries `?next` back to the
  CLI device-flow authorize page, so a brand-new user can sign up mid-login
  instead of dead-ending. `keynv` prints a "create a free account first" hint
  when the cloud target is chosen, and the connect-menu labels are even-handed.
- **Clearer `keynv init`** — one explicit "About to apply" summary lists every
  file it touches (wrapped scripts, `.keynv.env`, `AGENTS.md`,
  `.env`→`.env.backup`) under a single confirmation; a greenfield project with
  no `.env` gets a concrete first-secret path instead of a "nothing to do"
  dead-end; the secret picker notes its selections are pre-checked and Enter
  accepts.

### Changed
- **Transparent script-wrapping** — setup wraps your `package.json` scripts so
  you run `npm run dev` / `npm test` normally and never type `keynv exec`
  yourself. Wrapping now also recognises monorepo/task runners (turbo, nx,
  lerna, make, npm-run-all).
- **`secret get` is safe by default** — a bare `keynv secret get` copies to the
  clipboard on a TTY and refuses to print in a non-interactive context;
  `--reveal` forces raw stdout, `--json` emits the structured value.
- **Self-host build is panel-only** — the marketing/SEO surface (second landing,
  changelog/RSS, `llms.txt`, sitemap, opengraph) is gated behind `KEYNV_HOSTED`
  and dropped from the self-host bundle; the root `/` goes straight to
  login/dashboard.
- **READMEs + docs rewritten vault-first** — the root and npm (`@keynv/cli`)
  READMEs lead with the vault + hosted quickstart; self-host docs are aligned
  with the one-command deploy (real pino boot logs, a single `app.` / `api.`
  domain convention, a Coolify "what you'll do" checklist, corrected
  `/data/master.key` path and `db:fail` health field).

### Removed
- **Dead surface** — inert notification settings and the `user_preferences`
  table, the unused `users.mfa_enrolled` column, and the stub `vault` /
  `integrations` panel pages.

### Fixed
- **Web session / CSRF 500** — CSRF signing and session sealing now share the
  one auto-generated web session secret; a duplicate getter previously threw in
  production when the env var was unset.
- **Empty-string env crash** — a compose `${VAR:-}` passing an empty string no
  longer trips the min-length validators; empty values are treated as unset.
- **Green main** — restored the authed-route login redirect and cleared
  stale-test / unused-import regressions that had left the panel Docker build
  red.
- **Misleading master-key error** — the "master key file not found" message no
  longer points at a nonexistent `keynv-server bootstrap` command.

## [0.1.0-rc.22] — 2026-07-02

### Added
- **Text-surface protection** — the first four primitives in keynv's runtime text-surface protection layer for AI workflows: `keynv doctor` (read-only retro scan that counts likely-leaked secrets across shell histories, Claude Code session transcripts, and Cursor logs without ever echoing raw values), `keynv scrub` (atomic in-place rewrite with `.keynv.bak.<ts>` backups, JSONL-safe via the redactor's JSON-safe replacement tokens, with mtime-based active-write protection so a live Claude Code session isn't clobbered), `keynv shell install|uninstall|status` (a preventive zsh / bash / fish history hook that scrubs secret-shaped substrings *before* they land in the history file — pure POSIX-ERE regex, no per-command subprocess unless a match fires), and `keynv watch start|stop|status` (a foreground real-time watcher daemon that subscribes to Claude Code transcript JSONL + Cursor log writes via chokidar, scrubs matched substrings on each change with a 1-second debounce, and persists lifecycle + scrub events to a local audit log at `~/.local/share/keynv/watcher.log`). Together these turn "your AI agent transcripts and shell history are silently leaking" into "you can see it, you can fix it, and you can stop it happening again — in real time."
- **`@keynv/text-surfaces`** — new workspace package exposing a stable `TextSurface` interface (`isPresent`, `enumerate`, `scan`, `rewrite`), built-in surfaces for zsh / bash / fish history, Claude Code session JSONL, and Cursor logs, plus a generic `scanFile` / `rewriteFile` helper for embedding the same primitive elsewhere. Scan results are non-sensitive by construction: previews are bounded to 3 chars and raw matched values never escape the package boundary.
- **Doctor entropy-detector path-prefix suppression** — surface scans pass `/`, `./`, `../`, `~/`, and `http(s)/file://` to the redactor's `excludePrefixes` so long filesystem paths and URLs stop tripping the high-entropy detector. Order-of-magnitude reduction in false positives on real machines without losing detection of vendor-prefixed tokens (AWS / GCP / GitHub / Stripe / Anthropic / OpenAI / Slack), JWTs, or credential-bearing URIs.
- **Shell hook pattern-bank mirror** — `apps/cli/src/shell/templates.ts` ships a hand-mirrored POSIX-ERE subset of `@keynv/redactor`'s `BUILTIN_PATTERNS` so the preventive hook catches the same vendor-prefixed tokens, JWTs, and credential-bearing URIs as the redactor's batch API. Substitution uses `#` as the sed delimiter (not `|`, which collides with regex alternation in BSD sed on macOS). Re-running `keynv shell install` upgrades the hook body so a keynv upgrade ships any new pattern automatically.
- **Watcher daemon lifecycle** — pidfile + status snapshot at `~/.local/share/keynv/watcher.{pid,status}`, append-only JSONL audit at `~/.local/share/keynv/watcher.log`. `keynv watch stop` escalates SIGTERM to SIGKILL after a 15s default timeout because chokidar's polling-mode teardown on big transcript trees can hang; orphaning the watcher is worse than skipping a few teardown steps. Watcher rewrites pass `includeActive: true` and `backup: false` to `rewriteFile` — a 1Hz cadence with backups would clutter the surface, and live transcripts are explicitly the point.
- **Fingerprint registry from resolution events** — `keynv exec` now connects to the watcher daemon (via a tiny newline-JSON RPC over `~/.local/share/keynv/watcher.sock`, chmod 0600) right after `resolveAllAliases` returns, and registers each resolved value. The watcher holds those values in an in-memory `FingerprintRegistry` (sha256[:8] fingerprints + plaintext, RAM-only, never persisted) and passes them as `literals` to each subsequent `rewriteFile` call. Net effect: secrets with formats the regex pattern bank doesn't catch (custom in-house tokens, opaque UUIDs, internal API keys with no vendor prefix) get scrubbed from transcripts *as long as they ever flowed through `keynv exec`*. Fire-and-(briefly)-wait client with a 200ms timeout — if no watcher is running, `keynv exec` silently moves on without blocking.

### Changed
- **README rewrite** — kills "self-hosted secrets manager" framing in favour of "runtime text-surface protection for AI coding workflows." Hero leads with `keynv doctor` output as the demo (62,311 leak signals on a real machine). Adds a "What keynv is not" section explicitly disclaiming Vault / Doppler / Infisical / 1Password / SSO / compliance positioning. Quickstart restructured into five sequential steps mirroring the Phase A primitives (find → scrub → prevent → watch → use aliases). Status table reflects Phase A primitives shipped. Cloud-tier messaging dropped from the OSS-facing pitch (kept only in the License section as a commercial-license boundary note).
- **Threat model** — `docs/02-threat-model.md` gains a runtime-text-surface section up top: explicit in-scope / out-of-scope lists per the new category, plus honest documentation of the sub-second race window between "secret lands in transcript" and "watcher rewrites it." The previous STRIDE walk-through is preserved below as the server-side audit reference. Trust is the product; overclaiming destroys it.
- **New docs** — `docs/00-vision.md` is the long-form manifesto: the AI-era threat shift, the two-primitives thesis, what's explicitly *not* on the roadmap (sandboxing, enterprise RBAC, multi-region HA), and how to judge whether a feature belongs in keynv. `docs/03-text-surfaces.md` defines the `TextSurface` interface, the built-in surfaces, atomic-rewrite semantics, JSONL safety invariants, the race-window detail, and the false-positive / false-negative posture.
- **Redactor output rebuild is now O(n)** (AUDIT-FINDINGS-4 Y1) — `redact()` builds its output in a single left-to-right pass and `join`s once, replacing the per-match right-to-left `slice + concat` that was O(matches × filesize) and dominated runtime on large scans (the "62,311 secrets" case). Output is byte-identical; only the allocation pattern changed.

### Security
- **Dev-dependency advisory bumps** — pnpm overrides pin `form-data >=4.0.6`
  (GHSA-hmw2-7cc7-3qxx, CRLF injection; reached only via the `supertest` test
  client) and `vite >=8.0.16` (GHSA-fx2h-pf6j-xcff, `server.fs.deny` bypass; the
  test/build bundler). Both are dev-only and absent from the shipped runtime;
  bumped to keep the release security-gate (`pnpm audit`) clean.
- **Redaction tail-leak on overlapping matches** (AUDIT-FINDINGS-4 K1) — the redactor's de-overlap step now extends the surviving match to the *union* span instead of dropping a later overlapping hit. Previously, when a shorter match started before and overlapped a longer one (reachably: two overlapping resolved alias values, e.g. `abc123def` + `def456ghi` in `abc123def456ghi`), the longer match was discarded and its tail survived in cleartext. Since `redact()` is the single choke point behind `doctor`, `scrub`, `exec` output, and the `watch` daemon, this closed a leak on every surface. Regression test added with deliberately staggered overlapping literals.
- **MCP reference token burned before fetch** (AUDIT-FINDINGS-4 K4) — `resolveTokenToValue` now *peeks* the single-use reference token, fetches the value, and only then consumes it. A transient network failure (or a project rename between issuance and resolution) previously burned the token before the fetch, permanently invalidating a valid capability token so the agent could not retry. Consumption is now gated on a successful fetch; the "never surface the raw value in an error" guarantee is preserved.
- **`keynv init --yes` plaintext classification leak** (AUDIT-FINDINGS-4 K2) — non-interactive auto-scan now treats `ambiguous` classifier verdicts as secrets (fail-safe), routing them into the vault as alias references. Previously only `secret` verdicts were protected and `ambiguous`/`literal` fell through into `.keynv.env` (advertised as safe-to-commit), so a single classifier false negative could write a real secret as committable plaintext with no human gate.
- **Web open-redirect in token refresh** (AUDIT-FINDINGS-4 B1) — `GET /api/auth/refresh` now routes its `next` target through `safeNext()`, closing the same protocol-relative (`//evil.com`) / backslash (`/\evil.com`) open-redirect that AUDIT-FINDINGS-2 H1 fixed for login/register but left unpatched on this route.
- **Web open-redirect** (AUDIT-FINDINGS-2 H1) — login and register actions now route the `next` redirect target through `safeNext()`, which rejects protocol-relative authorities (`//evil.com`), backslash variants (`/\evil.com`), header-injection control characters, and any value whose origin doesn't match the current host.
- **Web CSRF gap** (H2) — `dismissOnboardingAction` now requires a CSRF token via the existing `CsrfProvider` context; silent reject on missing/forged tokens keeps the onboarding checklist visible under attack.
- **Server cross-org disclosure** (H3) — non-admin `GET /v1/projects` path now scopes the database query by `org_id` instead of pulling every org's project rows into Node memory before an in-memory membership filter.
- **Server approvals race** (H4) — `ensurePendingApproval` now uses `INSERT ... ON CONFLICT DO NOTHING` against a partial UNIQUE index on `(project_id, alias, requester_user_id) WHERE status='pending'`, so concurrent reads of the same require-approval secret collapse to a single pending row instead of doubling the lead's queue. New migration `0008_approvals_unique_pending.sql` dedupes any pre-existing duplicates.
- **Server user-mutation TOCTOU** (H5) — `PATCH /v1/users/:id/org-role` and `DELETE /v1/users/:id` now include `org_id` alongside `id` in their `WHERE` clauses, closing the seam future concurrent org-move code paths would have tripped on.
- **Web CSP tightening** (M1) — production `script-src` no longer carries `'unsafe-eval'`; dev keeps it for React Refresh. `'unsafe-inline'` for scripts is tracked as a follow-up (needs a per-request nonce middleware).
- **Web session sunset + HSTS** (M2) — legacy v1 (HMAC-only) session cookies are accepted until `2026-07-01T00:00:00Z` and rejected after, forcing a one-time re-login onto AES-256-GCM v2 cookies. Production responses now emit `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- **CLI init TUI secret preview** (M3) — `keynv init`'s multiselect checklist no longer renders the first 27 characters of detected secrets. New `maskedPreview(value, hint)` shows `[••••] (hint, N chars, fp:XXXX)` where the four-hex fingerprint is the first four chars of SHA-256, enough for visual deduplication but cryptographically infeasible to invert.

### Fixed
- **Audit schema drift** (H6) — `POST /v1/users` (admin invite) was returning 500 because the audit payload included `org_id` but the strict `'user.invited'` schema in `@keynv/core` didn't accept it. Adding `org_id` to the schema unblocks invites; the user row was already being inserted before the audit append failed, so the previous behaviour left split-brain state in the audit chain.

### Tests
- New e2e specs at `tests/e2e/tests/csrf.spec.ts` (verifies the register form rejects submission with the CSRF input removed) and `tests/e2e/tests/security-headers.spec.ts` (verifies CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, and the production HSTS header).
- New server regression tests: parallel `ensurePendingApproval` calls collapse to one row; developer in org A cannot see org B's projects via `GET /v1/projects`; owner B cannot patch or delete a user belonging to org A.
- New unit tests: `safeNext` (9 cases), `maskedPreview` (5 cases), `securityHeaders` (5 cases), `decodeSession` v1 sunset (3 cases), `dismissOnboardingAction` CSRF gating (3 cases), `'user.invited'` audit schema happy path.
- New regression tests for the AUDIT-FINDINGS-4 critical fixes: redactor no longer leaks the tail of a longer secret on partial overlap (staggered literals); `resolveTokenToValue` keeps the reference token redeemable after a transient fetch failure and remains single-use on success; `keynv init --yes` routes an `ambiguous` entry into the vault instead of writing it as plaintext.

## [0.1.0-rc.21] — 2026-05-15

### Fixed
- CLI browser authorization redirects now preserve the `code` query parameter when unauthenticated users are sent through login.
- CLI browser auth start now uses the existing per-IP auth rate limit to reduce unauthenticated flow spam.

## [0.1.0-rc.17] — 2026-05-15

### Added
- **TUI-first onboarding**: running `keynv` now guides first-time users through keynv.dev or self-hosted connection, then offers to set up the current project from the same menu. Users no longer need to discover `keynv login` or `keynv init` for the happy path.
- **Release smoke checks**: the release workflow now verifies the built CLI reports the tag version before publishing, then verifies the freshly published npm package with `npm exec` before completing.
- **Web CSRF protection**: mutating web forms now include signed CSRF tokens, and server actions reject missing, expired, or tampered tokens with a safe error.
- **Web session sealing**: web session cookies now use AES-256-GCM sealing with legacy signed-cookie fallback, so refresh tokens are no longer stored as readable JSON in the browser cookie.
- **Root error boundary**: added a global public error boundary for root/layout-level failures.

### Changed
- Documentation now presents `keynv` as the primary command for connecting accounts and setting up projects; direct `login`/`init` commands remain available for automation and advanced use.
- Secret deletion in the web UI now hides the deleted alias optimistically and restores it if the server action fails.

### Fixed
- The token refresh route now decodes the session through the shared session helper instead of parsing raw cookie text, and no longer trusts a client-controlled `server_url` fallback.
- CLI and docs no longer point users toward command-only setup when the guided TUI is available.
- Release publishing no longer masks npm publish failures with `|| true`, preventing stale npm artifacts from looking successful.

## [0.1.0-rc.16] — 2026-05-15

### Fixed
- **Server integration tests**: all 4 route handlers that used `db.transaction(async (tx) => …)` now use synchronous callbacks. better-sqlite3 v11 rejects Promise-returning transaction callbacks, causing a ROLLBACK and subsequent FK constraint failures on every insert-after-rollback. Affected routes: `POST /v1/auth/register`, `POST /v1/projects`, `POST /v1/projects/:id/secrets/:env/:key/rotate`, `POST /v1/org`.
- **E2E tests on Windows**: `playwright.config.ts` and `next.config.ts` used `new URL(...).pathname` which produces `/C:/...` on Windows — an invalid path for `spawn` cwd. Replaced with `fileURLToPath()` from `node:url`.
- **Redactor preview leak (M1)**: `preview()` truncated to 4 chars for secrets > 4 chars long, allowing reconstruction of 5–8 char secrets. Tightened to 3 chars + `...`. Trust boundary documented in `Match.preview` JSDoc.
- **X-Keynv-Agent trust boundary (M2)**: documented that the header is client-controlled and informational only — never used for authorization. Authenticated identity comes from JWT.
- `keynv init` now auto-generates `.keynv.<env>.env` files for each non-default environment (e.g. `.keynv.prod.env`) so `keynv exec --from .keynv.prod.env` works immediately after init without manual file creation.

### Security
- All 14/14 audit findings now resolved (M1, M2 were the last two deferrals).

## [0.1.0-rc.14] — 2026-05-13

### Added
- `keynv init --yes` flag — auto-scans .env files, classifies entries, creates project, uploads secrets, and writes `.keynv.env` without any prompts. Enables fully automated CI/CD migration.
- `resolveProjectId` now performs case-insensitive project name matching.
- `keynv exec` subprocess PATH now includes nearest `node_modules/.bin` so project-local tools (`next`, `vite`, etc.) work without `npx`.
- Public registration endpoint `POST /v1/auth/register` — opt-in via
  `KEYNV_PUBLIC_REGISTRATION=true`. Creates a fresh org + owner user
  atomically and returns a JWT pair. Tighter per-IP rate limit
  (`KEYNV_REGISTER_RATE_LIMIT_PER_MINUTE`, default 5/min) lives on
  this route alone; authed routes keep the per-user budget. Self-host
  deployments default to off, so the open-source binary never grows
  multi-tenant signup unless the operator chooses it. This prepares a
  future hosted keynv Cloud preview without making it a shipped Cloud
  feature.
- Web `/register` page mirrors the login flow. Falls back to the
  login page with a `registration_disabled` reason banner when the
  current instance has the flag off.
- `/v1/health` exposes a `capabilities.public_registration` boolean
  so the frontend can hide the signup link on instances that opted
  out.
- Audit chain learned an `auth.register` event type (validated payload
  schema in `@keynv/core`).

### Fixed
- CLI no longer stays stuck in the interactive menu loop after completing login + init — auto-exits with a clean "All set." message.
- `keynv init --dry-run` no longer requires an interactive terminal; works in CI with `--env-file` and `--secret` flags.
- `keynv secret list` now correctly extracts project names from `@project.env.key` aliases via `parseAlias()` instead of naive string splitting.
- Secret key format preserved — env var names like `DATABASE_URL` or `OPENAI_API_KEY` keep their original case and underscores instead of being lowercased to kebab-case.
- Server VERSION now reads from `package.json` instead of a hardcoded string that went out of sync.
- Onboarding checklist in web dashboard uses a placeholder server URL instead of hardcoded `https://api.keynv.dev`.
- `keynv project describe <name>` now accepts project name (in addition to ID). Previously only accepted ID.
- `keynv init` gains `--env-file`, `--project`, `--env`, `--secret` flags for non-interactive/CI usage.
- CLI authorize page and project-switcher filter now use the shared `<Input />` component for visual consistency.
- Onboarding step 4 ("Onboard your AI agents") now marks complete once the user has resolved a secret via `keynv exec`, instead of always showing as incomplete.
- `keynv exec` warns when no `.keynv.env` is found and suggests running `keynv init`.
- Network errors in CLI commands now include the server URL and a `curl /v1/health` hint.
- Keychain load failures are surfaced with an explicit error message instead of a silent "not logged in".
- Onboarding checklist dismissal is now persisted server-side (`users.onboarding_dismissed_at`) so it persists across devices and browsers. DB migration: `0005_onboarding_dismissed.sql`.

### Notes
- For the future hosted public beta, no usage limits are enforced yet. Free-tier quotas
  (3 projects · 3 envs · 5 members) and paid plans live in the
  closed-source `packages/ee/billing/` path that ships in Phase 6.
  Early users will be grandfathered onto a generous plan when paid
  tiers activate; the OSS code path keeps `plan='unlimited'` for
  every org.

## [0.1.0-rc.1] — 2026-05-10

First public release candidate. Self-host stack is functional end-to-end:
server, CLI, MCP server, web dashboard, and the AI-safety layer
(privileged subprocess wrapper + output redactor) all ship together.

### Added

#### Core vault & CLI (Phase 1)
- Hono-based REST server (`apps/server`) with envelope encryption — per-project DEK,
  master KEK held in OS keychain or `master.key` file, XSalsa20-Poly1305 via libsodium.
- Drizzle ORM over better-sqlite3 (WAL mode); hand-written migrations 0001–0003.
- 5-role RBAC (`packages/rbac`): `owner`, `admin`, `developer`, `reader`, `bot`.
  Project-scoped membership overrides org-level role.
- Append-only, SHA-256 hash-chained audit log; `POST /v1/audit/verify` walks the
  chain in 1000-row pages and threads the previous tail-hash across boundaries.
- JWT access tokens (15-min) + opaque refresh tokens (sha256-hashed at rest, rotated).
- CLI (`apps/cli`, Bun-compiled): `login`, `project`, `secret`, `member`, `audit`,
  `whoami`, `exec --`, `redact`, `redact-stream`, `test`, `install`.

#### AI-safety layer (Phase 2)
- `keynv exec --` privileged subprocess wrapper. Resolves `@project.env.key` aliases
  in a child process whose env/argv/stdin the agent's process tree never inherits.
- `keynv-mcp` MCP server (stdio transport). `use_secret(alias)` returns a single-use,
  60s reference token; `keynv exec --resolve NAME=<token>` redeems it over a local
  0600 socket and injects the value into the subprocess — the resolved value never
  crosses the MCP boundary back to the agent.
- Output redactor (`packages/redactor`): pattern bank (50+ vendor regex rules) +
  Shannon-entropy fallback. Streaming + batch APIs.
- Per-agent onboarding via `keynv init`: scans existing `.env` files, migrates
  secrets to vault, writes `.keynv.env` with alias references only. Safe to commit.

#### Connection testers (Phase 3)
- `packages/testers` adapter pattern. Built-in: Postgres, MySQL, Redis, SSH, HTTP
  (basic/bearer/custom header). `keynv test @alias` reports OK/FAIL + latency,
  never values.

#### Web UI for team leads (Phase 4)
- Next.js 15 App Router dashboard (`apps/web`), React 19, Tailwind 4, Radix primitives.
- Linear/Raycast/Arc-style dark-first density. ⌘K command palette, g-prefix shortcuts.
- Pages: `/projects`, `/projects/[id]/{secrets,audit,members,status,approvals,settings}`,
  `/audit`, `/admin/users`, `/settings/account`, `/login`.
- Mobile responsive (sheet drawer + hamburger top bar).
- Production-access approval state machine: `pending → granted | denied → expired`,
  with grant/deny dialogs and expires_at-driven sweep.
- Connection tester integration: `/projects/[id]/status` board pulls live test
  results for every secret aliased as a connection target.
- CLI tokens (`kt_` prefix, sha256-hashed) for headless / CI auth.

#### Self-host deployment
- Multi-stage Dockerfile + `deploy/docker-compose.yml`.
- First-start auto-bootstrap: when `KEYNV_BOOTSTRAP_OWNER_*` env vars are set and the
  vault is empty, the server creates the org + owner + initial project on boot.
- `deploy/COOLIFY.md` walkthrough for Coolify-based self-host.
- Static landing page at `apps/landing/index.html`.

### Security

- **Threat model** (`docs/02-threat-model.md`) — STRIDE walkthrough for every
  attack surface.
- **AUDIT-FINDINGS.md** — original Phase 4 audit. All blockers (B1–B3) and Highs
  (H1, H4, H5) closed; deferred Mediums (H2, H3, M3–M6) closed.
- **AUDIT-FINDINGS-PHASE5.md** — public-release audit. Finding A1 (no rate limiting
  on authenticated routes) resolved by `apps/server/src/lib/rate-limit.ts`:
  per-user fixed-window-of-1-minute token bucket, default 120 req/min, configurable
  via `KEYNV_RATE_LIMIT_PER_MINUTE`. Returns `429 rate_limited` with
  `Retry-After` and `X-RateLimit-*` headers.
- **Crypto**: argon2id for password + refresh-token hashing; libsodium for vault
  encryption; `crypto.timingSafeEqual` on every token comparison.
- **gitleaks** pre-commit hook + CI scan on full history.
- **No secret values in logs** — pino redactor pattern bank + per-route validation.
- **No raw secret values from MCP** — reference-token semantics enforced.

### CI / tooling
- `ci.yml`: lint + typecheck + test (Node 22) + gitleaks. Required for `main`.
- `security.yml`: nightly `pnpm audit` + CodeQL.
- `release.yml`: tag-driven, drafts the GitHub Release with checksums.
  (Multi-arch Docker push + Bun-binary attach lands in `0.1.0`.)
- biome (single tool — no ESLint, no Prettier).
- vitest + supertest (Node side); `bun:test` for the CLI binary.

### License
- **MIT** — finalized; see [`docs/decisions/0001-license-choice.md`](./docs/decisions/0001-license-choice.md).
- Phase 6 commercial modules will live under `packages/ee/*` with a separate
  source-available license; nothing under that path today.

### Known gaps (deferred to 0.1.x or 0.2.0)

- **AF-1..5, AF-7** (Phase 5 audit sub-findings): real materialised tests for
  `tests/security/{env-files,env-enumeration,privileged-subprocess,mcp-reference-token}.test.ts`,
  Argon2id parameters via env (`KEYNV_ARGON2_*`), JWT signing key rotation
  runbook in `docs/01-architecture.md`. Not release-blocking.
- **Signed binaries** (cosign keyless OIDC) — deferred to `0.2.0`.
- **Helm chart automated OCI push** — chart stays in `deploy/helm/keynv` but
  no automated push for `0.1.0`. Re-add when k8s users ask.
- **Postgres adapter, KEK rotation flow, MFA, SSO/SAML, multi-region** —
  Phase 6 (commercial tier + keynv Cloud).

[Unreleased]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.23...HEAD
[0.1.0-rc.23]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.22...v0.1.0-rc.23
[0.1.0-rc.22]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.21...v0.1.0-rc.22
[0.1.0-rc.21]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.20...v0.1.0-rc.21
[0.1.0-rc.17]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.16...v0.1.0-rc.17
[0.1.0-rc.16]: https://github.com/keynv-labs/keynv/releases/tag/v0.1.0-rc.16
[0.1.0-rc.1]: https://github.com/keynv-labs/keynv/releases/tag/v0.1.0-rc.1
