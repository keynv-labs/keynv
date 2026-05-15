# Changelog

All notable changes to keynv will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> [!NOTE]
> keynv is in pre-1.0. Minor versions (`0.x.0`) may include breaking schema or
> API changes; patch versions (`0.x.y`) are backwards-compatible. The full
> stability promise lands at `1.0.0`. See [`CONTRIBUTING.md`](./CONTRIBUTING.md#deprecation-policy).

## [Unreleased]

## [0.1.0-rc.18] — 2026-05-15

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

### Fixed
- CLI no longer stays stuck in the interactive menu loop after completing login + init — auto-exits with a clean "All set." message.
- `keynv init --dry-run` no longer requires an interactive terminal; works in CI with `--env-file` and `--secret` flags.
- `keynv secret list` now correctly extracts project names from `@project.env.key` aliases via `parseAlias()` instead of naive string splitting.
- Secret key format preserved — env var names like `DATABASE_URL` or `OPENAI_API_KEY` keep their original case and underscores instead of being lowercased to kebab-case.
- Server VERSION now reads from `package.json` instead of a hardcoded string that went out of sync.
- Onboarding checklist in web dashboard uses a placeholder server URL instead of hardcoded `https://api.keynv.dev`.

## [0.1.0-rc.14] — 2026-05-13

### Added
- Public registration endpoint `POST /v1/auth/register` — opt-in via
  `KEYNV_PUBLIC_REGISTRATION=true`. Creates a fresh org + owner user
  atomically and returns a JWT pair. Tighter per-IP rate limit
  (`KEYNV_REGISTER_RATE_LIMIT_PER_MINUTE`, default 5/min) lives on
  this route alone; authed routes keep the per-user budget. Self-host
  deployments default to off, so the open-source binary never grows
  multi-tenant signup unless the operator chooses it. Powers the
  hosted **keynv Cloud** (keynv.dev) preview.
- Web `/register` page mirrors the login flow. Falls back to the
  login page with a `registration_disabled` reason banner when the
  current instance has the flag off.
- `/v1/health` exposes a `capabilities.public_registration` boolean
  so the frontend can hide the signup link on instances that opted
  out.
- Audit chain learned an `auth.register` event type (validated payload
  schema in `@keynv/core`).

### Fixed
- `keynv project describe <name>` now accepts project name (in addition to ID). Previously only accepted ID.
- `keynv init` gains `--env-file`, `--project`, `--env`, `--secret` flags for non-interactive/CI usage.
- CLI authorize page and project-switcher filter now use the shared `<Input />` component for visual consistency.
- Onboarding step 4 ("Onboard your AI agents") now marks complete once the user has resolved a secret via `keynv exec`, instead of always showing as incomplete.
- `keynv exec` warns when no `.keynv.env` is found and suggests running `keynv init`.
- Network errors in CLI commands now include the server URL and a `curl /v1/health` hint.
- Keychain load failures are surfaced with an explicit error message instead of a silent "not logged in".
- Onboarding checklist dismissal is now persisted server-side (`users.onboarding_dismissed_at`) so it persists across devices and browsers. DB migration: `0005_onboarding_dismissed.sql`.

### Notes
- During public beta no usage limits are enforced. Free-tier quotas
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
- `keynv-mcp` MCP server (stdio + http transports). `use_secret(alias)` returns a
  single-use reference token; the resolved value never crosses the MCP boundary.
- Output redactor (`packages/redactor`): pattern bank (50+ vendor regex rules) +
  Shannon-entropy fallback. Streaming + batch APIs.
- Per-agent onboarding via `keynv init`: scans existing `.env` files, migrates
  secrets to vault, writes `.keynv.env` with alias references only. Safe to commit.

#### Connection testers (Phase 3)
- `packages/testers` adapter pattern. Built-in: Postgres, MySQL, Redis, MongoDB,
  SSH, HTTP (basic/bearer/oauth2), AWS IAM (`sts:GetCallerIdentity`), GCP service
  account, Azure SP. `keynv test @alias` reports OK/FAIL + latency, never values.

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

[Unreleased]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.18...HEAD
[0.1.0-rc.18]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.17...v0.1.0-rc.18
[0.1.0-rc.17]: https://github.com/keynv-labs/keynv/compare/v0.1.0-rc.16...v0.1.0-rc.17
[0.1.0-rc.16]: https://github.com/keynv-labs/keynv/releases/tag/v0.1.0-rc.16
[0.1.0-rc.1]: https://github.com/keynv-labs/keynv/releases/tag/v0.1.0-rc.1
