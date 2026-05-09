# Phase 1 — Core Vault & CLI

**Duration estimate**: 3–4 weeks (full-time, solo).

**Goal**: Ship a working secrets vault with auth, RBAC, audit log, and a CLI that lets a small team manage projects, secrets, and members. By end of Phase 1, a team lead can self-host keynv, create a project, add a secret, grant a developer access, and have that developer resolve the secret over the network.

**Status**: blocked on Phase 0.

---

## Scope

- `apps/server/` — the Hono REST API + SQLite vault.
- `apps/cli/` — the `keynv` CLI binary (Bun-compiled).
- `packages/core/` — encryption primitives, alias parser (already from Phase 0), audit-chain utility.
- `packages/rbac/` — role + permission engine.
- The local cache layer in `~/.keynv/cache.db`.

Out of scope (deferred to later phases):

- The `keynv exec` privileged subprocess (Phase 2).
- The MCP server (Phase 2).
- Connection testers (Phase 3).
- Web UI (Phase 4).
- Litestream packaging beyond a documented sidecar (Phase 5).

## Deliverables

### Server

#### Schema & migrations (`apps/server/src/db/schema.ts`)
The full Phase-1 schema as in [01-architecture.md §storage-layout](../01-architecture.md#storage-layout):

- `orgs`, `users`, `projects`, `environments`, `secrets`, `memberships`, `audit`, `auth_refresh_tokens`.

Drizzle with SQLite dialect; migrations in `apps/server/migrations/`.

#### Auth endpoints
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/users/invite`
- `POST /v1/users/accept-invite`

Refresh tokens are hashed-at-rest, device-fingerprint-bound. JWT signing with HS256 + per-server HMAC secret loaded at boot.

#### Project & member endpoints
- `GET /v1/projects`
- `POST /v1/projects`
- `GET /v1/projects/:id`
- `DELETE /v1/projects/:id`
- `POST /v1/projects/:id/rotate-dek`
- `GET/POST/PATCH/DELETE /v1/projects/:id/members(/:user_id)`

#### Secret endpoints
- `POST /v1/projects/:id/secrets`
- `GET /v1/projects/:id/secrets`
- `GET /v1/projects/:id/secrets/:env/:key`
- `POST /v1/projects/:id/secrets/:env/:key/rotate`
- `DELETE /v1/projects/:id/secrets/:env/:key`

Two response shapes for the resolve endpoint: plain (when called without cache mode) and wrapped (when called with `?wrapped=1` from the CLI cache flow).

#### Audit endpoints
- `GET /v1/audit?...`
- `POST /v1/audit/verify`

#### RBAC enforcement
The `authorize(user, action, ctx)` function from `packages/rbac` is called at the start of every protected handler. There is exactly one path through `authorize`; no ad-hoc checks.

#### Envelope encryption
Master KEK loaded at boot from `KEYNV_MASTER_KEY_FILE` (default `/etc/keynv/master.key`, mode 0400). Per-project DEKs generated at project creation, wrapped with KEK, persisted. Secret values encrypted with project DEK.

`packages/core/src/crypto/` exposes:
- `wrapDek(dek, kek)` / `unwrapDek(wrapped, kek)`
- `encryptSecret(value, dek)` / `decryptSecret(sealed, dek)`
- `generateMasterKey()` / `generateDek()`

#### Audit chain
Every protected mutation appends an audit row with `prev_hash` chained from the previous row. SHA-256 over `prev_hash || canonicalize(payload) || ts || actor_user_id`.

`keynv audit verify` walks the chain incrementally (cursor-based for large chains).

#### Logging & observability
- pino with redactor configured (`redact: ['*.value', '*.password', '*.access_token', '*.refresh_token', '*.dek', '*.kek']`).
- Request id per HTTP request (forwarded to client in `X-Request-Id`).
- `/v1/health` endpoint returns build version + DB ping + Litestream lag (parsed from sidecar status file).

#### Server startup script
- `keynv-server bootstrap` — first-run interactive (or `--non-interactive`) setup: generate master KEK, save to file, print recovery code, create initial Owner account.
- `keynv-server start` — normal start.
- `keynv-server kek rotate` — KEK rotation operation (off-line; requires server stop or read-only mode).

### CLI (`apps/cli/`)

Built with Bun, compiled via `bun build apps/cli/src/index.ts --compile --outfile dist/keynv`.

#### Subcommands (Phase 1 set)

```
keynv login          -- email/password auth, stores refresh token in OS keychain
keynv logout         -- clears local auth state
keynv whoami         -- prints user, org, role, memberships

keynv project create <name>
keynv project list
keynv project describe <name>
keynv project delete <name>            -- requires --force when secrets exist

keynv member add <project> <email> --role <role>
keynv member remove <project> <email>
keynv member list <project>

keynv secret create <alias> --value <v>     -- alias is @project.env.key
keynv secret create <alias> --stdin         -- read value from stdin (preferred for multi-line)
keynv secret get <alias>                     -- subject to RBAC; never logs the value
keynv secret list <project> [--env <env>]
keynv secret rotate <alias> --value <v>      -- creates version N+1
keynv secret delete <alias>

keynv audit list [--project <p>] [--since <iso>] [--limit <n>]
keynv audit verify [--from <id>]
keynv audit export --format json|csv > out.txt

keynv config init                       -- writes a starter .keynv.toml in cwd
```

`keynv exec`, `keynv install`, and `keynv test` are Phase 2/3, not Phase 1.

#### Local cache
- SQLite at `~/.keynv/cache.db` (or `$XDG_CACHE_HOME/keynv/cache.db`).
- Cache KEK in OS keychain (`keytar` or platform-specific abstraction).
- TTL: configurable (default 5 min). Stale-while-revalidate behavior on lookups.
- Eviction on logout / on KEK-rotation event from server.

#### Output formatting
- Default human-readable.
- `--json` flag on every read command for machine consumption.
- Table output uses Unicode box-drawing where supported, ASCII fallback when piped.

### `packages/rbac/`

The `authorize` function plus the role matrix. Tests cover every cell of the matrix in [04-rbac-and-permissions.md](../04-rbac-and-permissions.md).

### Documentation

- `docs/runbook/operating-keynv-server.md` — install, bootstrap, daily ops, KEK rotation.
- `docs/runbook/disaster-recovery.md` — Litestream restore from backup, master-KEK recovery.
- Update `README.md` with installation and basic usage flows.

### Tests

- Unit: > 80% coverage on `packages/core` and `packages/rbac`.
- Integration: end-to-end flows through the API (supertest against an in-memory SQLite).
- Property: parser + crypto roundtrips.
- Synthetic-load: 100K-secret project, 1M-row audit chain, verify chain walks in < 30 s.

## Acceptance criteria

Phase 1 ships when, on a clean Linux VM:

```bash
keynv-server bootstrap --non-interactive --owner-email lead@team.com --owner-password '...'
keynv-server start &

keynv login --server http://localhost:8080 --email lead@team.com
keynv project create billing --env dev --env prod
keynv member add billing alice@team.com --role developer

# alice's machine
keynv login --email alice@team.com
keynv secret list billing
# (empty)

# back on lead
keynv secret create @billing.dev.test_key --value "abc123"

# alice
keynv secret get @billing.dev.test_key   # returns "abc123"

# lead
keynv audit list --project billing
# shows: project.create, member.add, secret.create, secret.read.allowed
keynv audit verify
# OK (chain valid)
```

And:
- `pnpm test` green.
- `pnpm typecheck` green.
- Coverage thresholds met.
- Server startup time < 1 s on a typical VM.

## Risks specific to Phase 1

| Risk | Mitigation |
|---|---|
| KEK loss bricks the deployment | Bootstrap output prints a recovery code with explicit "store this offline" instructions. Documented runbook for KEK rotation and recovery. |
| Refresh-token rotation race conditions | Rotation is atomic in the DB; old refresh token is revoked in the same transaction. |
| Audit-chain becomes the bottleneck under burst | `synchronous=NORMAL` + WAL + group-commit. Validated in Phase 0 spike. |
| Bun-binary CLI doesn't load `better-sqlite3` for the local cache | Phase 0 spike validates. If broken, fall back to `bun:sqlite` (Bun's built-in SQLite binding). |
| Auth flow UX is annoying | First-cut uses email/password with refresh tokens. Token-only login (`keynv login --token`) is an early backup option. SSO is Phase 6. |

## Hand-off to Phase 2

Phase 2 starts with:
- A live server you can `POST` secrets into.
- A CLI that resolves aliases and returns plaintext.
- An RBAC layer to lean on.
- Audit infrastructure to record `keynv exec` invocations.
- The reference parser ready to be invoked on argv at exec time.
