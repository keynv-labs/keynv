# 01 — Architecture

This document describes the components, data flow, and deployment topology of keynv. Read it after [00-vision-and-scope](./00-vision-and-scope.md) and before any phase doc.

## Component overview

```
┌───────────────────────────────────────────────────────────────────┐
│                        Developer's machine                         │
│                                                                    │
│  ┌──────────────┐      ┌─────────────────────────────────────┐   │
│  │  AI Agent    │      │           Safety Layer              │   │
│  │ (Claude/...) │─────▶│  • keynv exec (shell wrapper)       │   │
│  │              │      │  • keynv-mcp (MCP server)           │   │
│  │ Sees only    │◀─────│  • Output Redactor                  │   │
│  │ @aliases     │      │  • keynv init (agent onboarding)   │   │
│  └──────────────┘      └────────────────┬────────────────────┘   │
│                                          │                         │
│                                          ▼                         │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                       keynv CLI                           │    │
│  │  (Bun-compiled single binary)                             │    │
│  │  • @alias parser & resolver                               │    │
│  │  • Privileged subprocess spawner                          │    │
│  │  • Local cache: SQLite + age-sealed                       │    │
│  │  • OS keychain client (Keychain/CredMgr/libsecret)        │    │
│  └────────────────────────┬─────────────────────────────────┘    │
└────────────────────────────┼──────────────────────────────────────┘
                             │ HTTPS  (mTLS optional)
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                        keynv Server (VM)                          │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Hono API   +   Drizzle ORM                        │  │
│  │  • Auth (JWT)                                               │  │
│  │  • RBAC (Owner/Admin/Lead/Developer/Reader)                 │  │
│  │  • Secret CRUD + envelope encryption                        │  │
│  │  • Audit log (append-only, hash-chained)                    │  │
│  │  • Connection-tester orchestration                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  SQLite (WAL mode)   ←  Litestream  →  S3 / B2  (backup)   │  │
│  │  • Encrypted-at-rest (envelope: master KEK → per-project   │  │
│  │    DEK → per-secret value cipher)                          │  │
│  │  • Single file. Microsecond reads.                          │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## Components in detail

### `apps/cli` — `keynv` (Bun-compiled, single binary)

The primary developer-facing tool. Shipped as a single platform binary (~30 MB). Subcommands:

- `login`, `logout`, `whoami`
- `init` (initialize a project's `.keynv.toml`)
- `project create|list|delete|describe`
- `secret create|get|list|delete|rotate`
- `member add|remove|list`
- `exec -- <cmd args...>` (the privileged subprocess wrapper)
- `test <alias>` (Phase 3)
- `audit list|verify`
- `status` (Phase 3)

Local cache lives at `~/.keynv/cache.db` (SQLite, age-sealed). The KEK for the cache is stored in the OS keychain.

Compile flow: `bun build apps/cli/src/index.ts --compile --target=bun-darwin-arm64 --outfile dist/keynv`. We ship binaries for darwin-arm64, darwin-x64, linux-x64, linux-arm64, and win-x64.

### `apps/server` — Hono REST API

Stateless HTTP server. Reads/writes the SQLite vault. Endpoints (full spec in [06-api-spec.md](./06-api-spec.md)):

- `POST /v1/auth/login`
- `GET /v1/projects`, `POST /v1/projects`, `DELETE /v1/projects/:id`
- `GET /v1/projects/:id/secrets`, `POST .../secrets`, `GET .../secrets/:alias`, `DELETE .../secrets/:alias`
- `POST /v1/projects/:id/secrets/:alias/test` (Phase 3)
- `GET /v1/audit?project=...&since=...`
- `POST /v1/members`, `DELETE /v1/members/:id`

Auth: short-lived JWTs (15 min) + refresh tokens (7 days). MFA hooks reserved for commercial tier.

### `apps/mcp` — `keynv-mcp` MCP server

Implements the Model Context Protocol over stdio (default) or HTTP (for daemon mode). Tools exposed:

- `use_secret(alias)` → returns a single-use **reference token** (not the value). The token resolves to the value only when passed to `keynv exec` or `test_connection` within 60 seconds.
- `list_secrets(project)` → returns alias names (never values).
- `test_connection(alias)` → returns `{ok: bool, latency_ms: number, error?: string}` (sanitized).
- `redact_text(text)` → returns the input with secret patterns masked. Useful for agents that want to inspect their own outputs before posting somewhere.

The MCP server is a thin RPC layer over the same CLI binary; no duplicate logic.

### `apps/web` — Next.js dashboard (Phase 4, post-MVP)

Server-rendered admin UI. Pages:

- `/projects` — list + create
- `/projects/:id/secrets` — manage secrets, view rotation history
- `/projects/:id/members` — RBAC management
- `/projects/:id/audit` — audit log with filters
- `/projects/:id/status` — connection-test health board
- `/settings/account` — token management (CLI auth tokens issued from here)

Auth: session cookies (server-rendered) + token mint endpoint for CLI.

### `packages/core`

Shared types, the `@alias` parser/resolver, envelope-encryption primitives, and audit-log utilities. Imported by `apps/cli`, `apps/server`, and `apps/mcp`.

Public API surfaces (sketch):

```ts
// reference parsing
parseAlias("@billing.prod.db_password"): {project, env, key} | null
findAliases(text): Array<{alias, project, env, key, range}>

// envelope encryption
generateMasterKey(): MasterKey
wrapDek(dek: DataKey, master: MasterKey): WrappedDek
unwrapDek(wrapped: WrappedDek, master: MasterKey): DataKey
encryptSecret(value: string, dek: DataKey): SealedSecret
decryptSecret(sealed: SealedSecret, dek: DataKey): string

// audit chain
appendAudit(prev: AuditEntry|null, event: AuditEvent): AuditEntry
verifyChain(entries: AuditEntry[]): {ok: boolean, brokenAt?: number}
```

### `packages/rbac`

The role / permission engine. Five roles, project-scoped permissions, runtime check.

```ts
type Role = "owner" | "admin" | "lead" | "developer" | "reader";
type Action = "secret.read" | "secret.write" | "secret.rotate"
            | "project.create" | "project.delete"
            | "member.invite" | "member.remove"
            | "audit.read";

can(role: Role, action: Action, ctx: {ownProject: boolean}): boolean
```

### `packages/redactor`

Output and file redaction.

- Built-in pattern bank (see [02-threat-model.md §pattern-bank](./02-threat-model.md))
- Shannon-entropy detector (configurable threshold)
- Per-project custom patterns
- Streaming line-buffered redactor (used by `keynv exec` to wrap subprocess stdout/stderr)

### `packages/testers`

One module per protocol. Each implements a common interface:

```ts
interface Tester {
  type: "postgres" | "mysql" | "redis" | "mongodb" | "ssh" | "http"
      | "aws-iam" | "gcp-sa" | "azure-sp";
  test(secret: ResolvedSecret): Promise<TestResult>;
}

interface TestResult {
  ok: boolean;
  latency_ms: number;
  error?: string;  // sanitized — never contains the value
}
```

## Data flow: a secret read

```
1. Developer types:   keynv exec -- mysql -p@billing.prod.db_password -h localhost
                          │
2. CLI parses argv,       ▼
   finds @aliases.    ┌───────────────────────────────┐
                      │ keynv CLI (privileged)        │
                      │  ─ check local cache for      │
3. If cached & fresh,─┤    @billing.prod.db_password  │
   skip server call.  │  ─ if miss/stale, GET /v1/... │
                      └────────────┬──────────────────┘
                                   │
4. Cache hit returns:              ▼
   {dek: encrypted, sealed: ...}
                      ┌───────────────────────────────┐
                      │ unwrap DEK with KEK from      │
                      │ OS keychain. Decrypt sealed   │
                      │ secret. Plaintext lives in    │
                      │ memory ONLY in this process.  │
                      └────────────┬──────────────────┘
                                   │
5. Spawn subprocess                ▼
   with substituted argv:    fork+exec("mysql", ["-psecret123", "-h", "localhost"])
   * Subprocess does NOT inherit  agent's env/fd/cwd.
   * Argv visible only via /proc/<pid>/cmdline to same uid.
                                   │
6. Pipe subprocess stdout          ▼
   through redactor.        ┌───────────────────────────────┐
                            │ Redactor: line-buffered.       │
                            │ Replace patterns → <REDACTED>  │
                            └────────────┬──────────────────┘
                                         │
7. AI agent's bash tool                  ▼
   sees:                       "Connected. Server version 8.0.36."
                               (instead of secret123 — never seen)

8. Audit entry appended:    {who: "alice", alias: "@billing.prod.db_password",
                             when: "2026-...", from_agent: "claude-code-1.5.0"}
```

## Deployment topology

### MVP (Phase 1–3)

```
┌──────────────────────────────────┐
│  Single VM                       │
│                                  │
│  ┌─────────────────────────┐     │
│  │  keynv-server binary    │     │
│  │  (Node 20 + Hono)       │     │
│  └────────┬────────────────┘     │
│           │                       │
│           ▼                       │
│  ┌─────────────────────────┐     │
│  │  SQLite (keynv.db)      │     │
│  │  WAL mode, fsync=normal │     │
│  └────────┬────────────────┘     │
│           │ shadow read           │
│           ▼                       │
│  ┌─────────────────────────┐     │
│  │  Litestream (sidecar)   │─────┼──▶ S3 / B2 (backup)
│  └─────────────────────────┘     │
│                                   │
│  systemd units:                   │
│   • keynv-server.service          │
│   • litestream.service            │
└───────────────────────────────────┘
```

Resource sizing: 2 vCPU / 2 GB RAM / 20 GB disk is enough for 50 users, 10K secrets, 90 days of audit history. SQLite + WAL handles tens of writes/sec without breaking a sweat.

### Phase 5 (OSS release)

- Same topology, packaged as Docker Compose (server + Litestream sidecar + reverse proxy with TLS).
- Helm chart for k8s users; still single replica, still SQLite.

### Phase 6 (commercial tier)

- Optional Postgres adapter for HA / multi-region.
- Optional HSM/KMS for KEK storage.
- Optional read-replica fanout for global teams.

## Storage layout

### SQLite tables (Phase 1)

```sql
-- One per organization (typically just one for self-hosted)
orgs(id, name, created_at)

-- Users in the org
users(id, org_id, email, password_hash, mfa_enrolled, created_at)

-- Per-project DEKs, wrapped by master KEK
projects(id, org_id, name, dek_wrapped, created_at)

-- The secrets themselves
secrets(
  id, project_id, env, key,            -- composite alias = @{project}.{env}.{key}
  ciphertext, nonce,                    -- libsodium secretbox
  version, prev_version_id,
  created_by, created_at,
  rotated_from, rotated_at
)

-- RBAC
memberships(user_id, project_id, role, granted_by, granted_at)

-- Append-only audit chain
audit(
  id INTEGER PRIMARY KEY,
  prev_hash TEXT NOT NULL,    -- SHA-256 of prev row's payload+hash
  hash TEXT NOT NULL,
  ts TEXT NOT NULL,
  actor_user_id TEXT,
  actor_agent TEXT,            -- "claude-code-1.5.0", "cli", "mcp", "web"
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL
)

-- For Phase 3
connection_tests(
  id, secret_id, ok, latency_ms, error_sanitized, ran_at
)
```

The audit table's hash chain is verified by `keynv audit verify`. Tampering with any historical row breaks every subsequent hash.

### Local CLI cache

```sql
-- ~/.keynv/cache.db (encrypted with key from OS keychain)
cached_secrets(alias TEXT PRIMARY KEY, ciphertext, dek_wrapped, fetched_at, ttl_s)
auth(server_url, refresh_token, expires_at)
prefs(key TEXT PRIMARY KEY, value)
```

Cache TTL defaults to 5 minutes. `keynv exec` may operate offline if the cache is fresh.

## Failure modes & recovery

| Failure | Behavior |
|---|---|
| Server unreachable, cache fresh | `keynv exec` succeeds (offline). |
| Server unreachable, cache stale | `keynv exec` fails fast with an explicit "stale cache, server unreachable" error. No fallback to clear-text storage. |
| OS keychain locked | CLI prompts for OS keychain unlock; if denied, fail. |
| SQLite WAL corruption | Litestream restore from S3 / B2 (RPO ~1s). Runbook lives in [`deploy/README.md`](../deploy/README.md) under "Disaster recovery". |
| Master KEK lost | All wrapped DEKs are unrecoverable. The KEK is held by the org owner; lost-KEK recovery requires re-keying every secret manually from a backup snapshot taken before the loss. |
| Audit hash chain broken | `keynv audit verify` flags the break point. The CLI refuses to write further until an admin acknowledges (forks the chain). |

## Operational procedures

### JWT signing key rotation

keynv uses symmetric HS256 JWTs signed with `KEYNV_JWT_SECRET`. The secret is loaded once at server start; all access tokens issued before a restart carry the old signature.

**Rotation steps:**

1. Generate a new secret: `openssl rand -base64 48`
2. Set `KEYNV_JWT_SECRET=<new-secret>` on the server environment (or update the Coolify / Compose env).
3. **Restart the server.** The new process picks up the new secret.
4. Existing access tokens (15-min TTL) and refresh tokens (7-day TTL) issued with the old secret **remain valid until they expire naturally**. The server verifies them against the new secret, so verification will fail. All callers must re-authenticate.

**Zero-downtime rotation** (for operators who cannot accept a re-auth window):

1. Deploy a second server instance with the new `KEYNV_JWT_SECRET` alongside the old.
2. Switch the load balancer / reverse proxy to the new instance.
3. Drain the old instance after 15 minutes (max access-token TTL).
4. Tear down the old instance.

**Revocation emergency** (suspected key compromise):

1. Rotate `KEYNV_JWT_SECRET` immediately (steps 1-3 above).
2. Run `DELETE /v1/auth/refresh` to revoke all outstanding refresh tokens (CLI: `keynv auth revoke-all`). This forces every user to log in again.
3. Audit the window between compromise detection and rotation via `keynv audit list --since <time>`.
4. If the compromise window is unknown, rotate all secrets in the vault (`keynv secret rotate --all`).

**Security note:** The JWT secret is a high-entropy opaque string that lives only in `KEYNV_JWT_SECRET`. It must never be committed to version control. In keynv's own Coolify deployment, it is injected via the Coolify env-secrets UI and never touches a `.env` file. Rotate it at least once per quarter and immediately if any credential with server access is rotated.

### Argon2id parameter tuning

Password hashing uses Argon2id with configurable parameters exposed as environment variables:

| Variable | Default | OWASP 2024 guidance |
|---|---|---|
| `KEYNV_ARGON2_MEMORY_KIB` | 19456 (19 MiB) | 19 MiB minimum; 46 MiB recommended |
| `KEYNV_ARGON2_TIME_COST` | 2 | 2 minimum; 3+ for higher security |
| `KEYNV_ARGON2_PARALLELISM` | 1 | 1 (single-threaded interactive auth) |

Self-hosters with ≥ 4 GB RAM available should raise memory to 46080 (45 MiB) and time cost to 3 for stronger brute-force resistance. Login latency scales ~linearly with timeCost and inversely with parallelism; verify latency < 500 ms under your expected load before increasing.

## Why not X?

- **Why not Postgres for the MVP?** A 15-person team writes <50 audit rows / second peak. SQLite's WAL handles that with microsecond latency. A separate Postgres instance is operational overhead with no benefit at this scale. Phase 6 adds Postgres for teams that need multi-instance HA.
- **Why not Vault?** Excellent product, wrong threat model focus. Vault has no agent-isolation story, no `keynv init` onboarding flow, no streaming output redactor.
- **Why not just a CLI + SOPS in git?** Works for solo devs. Doesn't scale to team RBAC, doesn't give you audit history, doesn't give you rotation, doesn't give you connection testing.
- **Why not browser/web auth on day one?** CLI-first is fastest to MVP. Web UI in Phase 4.
- **Why not Go or Rust?** TypeScript everywhere = one language, one toolchain, one mental model for contributors. Bun gets us a single binary with ~50 ms cold start. Rust would be marginally safer but slower to iterate; Go would lose us the same TypeScript ecosystem the MCP SDK and most npm secrets-related libraries already use.
