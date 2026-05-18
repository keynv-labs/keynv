# Roadmap

A flat status view of where keynv is, in order. Each phase used to have its
own detailed plan file under `docs/phases/`; those have been retired in
favour of this single page. Phase plans lived in `git log` if anyone needs
to dig.

> [!NOTE]
> Phase 4 ships in slices instead of one big release. The slice list at the
> bottom of this page is the live work tracker.

## Status snapshot

| Phase | Theme | Status |
|---|---|---|
| **0** | Discovery & spike | ✓ done |
| **1** | Core vault & CLI | ✓ done |
| **2** | Universal AI-safety layer | ✓ done |
| **3** | Connection testers | ✓ done |
| **4** | Web UI for team leads | ✓ done (11 slices shipped) |
| **5** | Hardening & public OSS release | ✓ done (`v0.1.0-rc.1` cut 2026-05-10) |
| **6** | Commercial tier + keynv Cloud | ○ not started |

---

## Phase 0 — Discovery & spike · DONE

Monorepo skeleton + bun-vs-node startup measurements + libsodium throughput
+ MCP roundtrip overhead. Outputs: lock the stack (Bun for CLI, Node for
server, libsodium-wrappers, better-sqlite3, Drizzle, Hono, clipanion). All
spike numbers met or beat their targets.

## Phase 1 — Core vault & CLI · DONE

The team-secrets product:

- Hono + better-sqlite3 server with envelope encryption (per-project DEK,
  master KEK in OS keychain or `master.key` file)
- Drizzle ORM + hand-written SQL migrations
- 5-role RBAC engine (`packages/rbac`) with org-level and project-level
  permission checks
- Append-only hash-chained audit log + verify endpoint
- CLI commands: `login`, `project`, `secret`, `member`, `audit`, `whoami`
- JWT access tokens + opaque refresh tokens (Argon2id-hashed at rest)

## Phase 2 — Universal AI-safety layer · DONE

The AI-isolation product:

- `keynv exec --` shell wrapper that resolves `@project.env.key` aliases
  inside a privileged subprocess the agent's process tree can't read
- `keynv exec` auto-loads a project-local `.keynv.env` mapping file so
  daily commands don't need flags
- the `keynv` setup flow walks an existing project's `.env` files, uploads
  detected secrets to the vault, and writes `.keynv.env` references
- `keynv-mcp` MCP server (stdio + http) that returns single-use reference
  tokens, never values
- Output redactor (regex + Shannon entropy) for tool results, exposed
  as `keynv redact` and `keynv redact-stream` for use in any pipeline

> Per-agent integration installers (`keynv install claude-code`,
> `cursor`, `aider`, `codex`, `opencode`) shipped in early rcs but were
> removed in 0.1.0-rc.8 once project setup made them redundant — with
> the source `.env` migrated and removed, there is no file for the
> agent to read, and the deny-list patterns were defending a
> non-existent target. The `keynv exec` wrapper plus the redactor
> remain the actual safety layer.

## Phase 3 — Connection testers · DONE

`packages/testers` adapter pattern with built-ins for postgres, mysql,
redis, ssh, and http (basic / bearer / custom header). `keynv test
@alias` returns OK / FAIL + latency, never the value.

## Phase 4 — Web UI for team leads · IN PROGRESS

Next.js 15 dashboard living in `apps/web/`. Server components by default,
session-cookie auth against the same server the CLI talks to.

Shipped slices:

| Slice | Scope | Status |
|---|---|---|
| 1+2 | Design tokens + new shell + `/projects` dashboard | ✓ |
| 3 | `/projects/[id]/secrets` daily-driver redesign | ✓ |
| 4 | `/audit` + `/projects/[id]/audit` timeline + chain banner | ✓ |
| 5 | ⌘K command palette + `g`-prefix shortcuts | ✓ |
| 6 | Mobile responsive (sheet drawer + hamburger) | ✓ |
| 7 | Project sub-route tabs + remaining redesigns | ✓ |
| 8 | `/admin/users` + `/settings/account` + password change | ✓ |
| 9 | CLI tokens (long-lived bearer tokens for headless auth) | ✓ |
| 10 | Connection tester + `/projects/[id]/status` board | ✓ |
| 11 | Approvals state machine + `/projects/[id]/approvals` | ✓ |

UX direction is locked in [`apps/web/REDESIGN.md`](../apps/web/REDESIGN.md)
(Linear / Raycast / Arc dark-first density).

## Phase 5 — Hardening & public OSS release · IN PROGRESS

Pre-public-launch hardening. Active streams in priority order:

| Stream | Scope | Status |
|---|---|---|
| **B** | CI re-activation (`ci.yml`, `security.yml`) | ✓ done |
| **D** | License finalize (MIT) + dep license audit | ✓ done |
| **A** | Security audit + remediation (semgrep / threat-model walkthrough) | ✓ done |
| **G** | Versioning (`v0.1.0-rc.1` cut), CHANGELOG, deprecation policy | ✓ done (2026-05-10) |
| **C** | Release pipeline — Bun binaries × 5 platforms + multi-arch Docker | ✓ done (darwin-x64 added) |
| **E** | Public docs polish (`getting-started.md`, integration guides) | ✓ done |
| **F** | `keynv server init` onboarding wizard | ✓ done |

Decision points (locked):

1. First public release: **`v0.1.0`** (pre-1.0 signal, breaking changes possible at minor).
2. Signed binaries (cosign): **implemented for `v0.2.0` release pipeline**. `0.1.0` shipped with checksums only.
3. Helm chart: **drop from automated release**; keep `deploy/helm/keynv` in tree.
4. External pentest: **deferred** (default = no). Rely on semgrep + snyk + codeql + manual walkthrough.
5. Docs: **GitHub MD only** for `0.1.0`. No standalone docs site.
6. OpenAPI: **`docs/06-api-spec.md` stays as source of truth.** No `zod-to-openapi` dep.
7. Backup/DR maturity: **implemented for `v0.2.0` docs** with RPO/RTO, restore drills, KEK loss handling, and post-restore validation.
8. API compatibility: **implemented for `v0.2.0` docs + health capabilities** with CLI feature checks for newly-added endpoints.
9. Plaintext memory hardening: **implemented for `v0.2.0` critical crypto paths** with byte-oriented secret APIs, server-side buffer zeroing, and documented JSON/CLI string boundaries.
10. Rotation automation: **implemented for `v0.2.0`** with rotation interval metadata, PATCH `/rotation` endpoint, rotation due/overdue discovery via `GET /rotations`, and `secret set-rotation` + `secret rotations` CLI commands.
11. Enterprise feature tracking: **deferred features tracked in Phase 6** with individual scope, status, and OSS/commercial delivery notes; v0.2 hardening does not block on these features.

## Phase 6 — Commercial tier + keynv Cloud · NOT STARTED

Two-track expansion:

**Self-host commercial modules** — drop-in for self-hosters who want them:
SSO/SAML/OIDC adapters, HSM/KMS integration (AWS KMS, GCP KMS, HashiCorp
Vault Transit), multi-step approval workflows, SIEM forwarding, Postgres
adapter (drop-in for SQLite when teams hit 50+ users), compliance helpers
(SOC2 / ISO27001 audit report generators), multi-region replication.

**keynv Cloud (managed)** — multi-tenant SaaS we operate. Free tier
(1 organisation · 3 projects · 3 envs/project · 5 members · unlimited
secrets · 7-day audit retention), Pro tier (the commercial modules above
+ longer audit retention), Enterprise (dedicated infra / SLA / on-call).

The honest line today: **keynv Cloud isn't built yet.** Self-host is the
only working path. The Cloud option is what Phase 6 ships.

### Enterprise feature tracking

Each deferred feature below has a scope statement, status, and notes about
OSS vs commercial delivery. These are candidate GitHub issues.

#### SSO/SAML/OIDC adapters

- **Scope**: pluggable SSO for self-host deployments. SAML 2.0 SP-initiated,
  OIDC code flow with PKCE. Configurable role mapping (claims → RBAC roles).
  Optional SCIM provisioning for managed member lists.
- **Status**: NOT STARTED — commercial module.
- **OSS vs commercial**: core `POST /v1/auth/login` (email/password) and
  `POST /v1/auth/refresh` remain OSS. SSO adapters ship as commercial
  self-host module (`packages/ee/auth-sso/`). keynv Cloud Pro+ includes
  managed SSO.
- **Dependencies**: RBAC already supports project/org-level roles. Needs
  org-level SSO config CRUD endpoints.

#### HSM/KMS integration

- **Scope**: delegate master KEK to AWS KMS, GCP KMS, or HashiCorp Vault
  Transit. Server unwraps DEKs via KMS decrypt call at startup. Support
  automatic key rotation via KMS-native mechanisms.
- **Status**: NOT STARTED — commercial module.
- **OSS vs commercial**: OSS keeps file-based `master.key`. KMS adapter
  ships as commercial self-host module (`packages/ee/kms/`). Managed KMS
  included in keynv Cloud Pro+.
- **Dependencies**: refactor `apps/server/src/kek/load.ts` to KMS interface;
  design KMS credential bootstrap flow.

#### Multi-step and multi-party approvals

- **Scope**: configurable approval chains (N of M quorum, ordered steps,
  auto-expiry). Per-environment or per-secret approval tiers. Audit log
  tracks each approve/deny step with full RBAC context.
- **Status**: NOT STARTED — commercial module.
- **OSS vs commercial**: OSS keeps single-step owner/admin/lead approvals
  (already implemented in `apps/server/src/routes/approvals.ts`). Multi-step
  chains ship as commercial self-host module (`packages/ee/approvals/`).
- **Dependencies**: expand approval schema to chains; notification system
  for pending approvals.

#### SIEM forwarding and audit retention

- **Scope**: stream audit events to SIEM via HTTPS webhook or syslog (RFC
  5424). Configurable retention policies (auto-delete audit rows after N
  days). Batched delivery with exponential backoff.
- **Status**: NOT STARTED — commercial module.
- **OSS vs commercial**: OSS keeps in-DB audit with manual query (already
  implemented). SIEM forwarding ships as commercial self-host module.
  keynv Cloud Pro+ includes configurable audit retention.
- **Dependencies**: audit table already supports event_type/payload filter;
  needs delivery worker queue.

#### PostgreSQL adapter

- **Scope**: drop-in Postgres backend for deployments >50 users. Drizzle ORM
  already supports Postgres dialect. Needs connection pooling, migration
  runner, and Litestream→pg_dump/pgBackRest backup guidance.
- **Status**: NOT STARTED — commercial module.
- **OSS vs commercial**: OSS ships SQLite + Litestream (current default).
  Postgres adapter ships as commercial self-host module
  (`packages/ee/postgres/`). keynv Cloud uses managed Postgres internally.
- **Dependencies**: abstract DB interface in `apps/server/src/db/`;
  Postgres-specific migration subdirectory; pool config.

#### Data residency and multi-region

- **Scope**: deploy keynv server in a specific region; keep secrets/audit
  data within that boundary. Guidance for multi-region read replicas (SQLite
  or Postgres). keynv Cloud Enterprise supports dedicated region deployment.
- **Status**: NOT STARTED — OSS guidance + Cloud Enterprise feature.
- **OSS vs commercial**: OSS self-hosters control their own region by
  deploying the server where they want. Commercial adds multi-region
  replication and Cloud managed region selection.
- **Dependencies**: Litestream already supports S3-compatible region
  selection; Postgres adapter needed for read replicas.

#### Break-glass access

- **Scope**: emergency access workflow for when normal approval path is
  blocked. Requires multi-party witness (2 of N) with auto-expiring
  temporary access grant. Full audit trail including witness identities.
  Optional dead-man's-switch for disaster scenarios.
- **Status**: NOT STARTED — commercial module.
- **OSS vs commercial**: OSS relies on manual approval bypass via RBAC
  (owner/admin can read any secret). Break-glass ships as commercial
  self-host module. keynv Cloud Enterprise includes managed break-glass.
- **Dependencies**: multi-party approvals; temporary credential bootstrap.

#### Python and Go SDKs

- **Scope**: official client libraries wrapping the keynv API with idiomatic
  patterns. Python: context-manager based `with keynv.secret(...)`. Go:
  `defer`-friendly `secret.Get(...)`. Both include in-process redaction,
  cached CLI auth tokens, and MCP integration helpers.
- **Status**: NOT STARTED — open-source (Apache 2.0).
- **OSS vs commercial**: SDKs are OSS. Commercial modules may ship SDK
  extensions for commercial-only endpoints.
- **Dependencies**: stable `/v1` API; CLI auth token format documented.

#### keynv Cloud (managed SaaS)

- **Scope**: multi-tenant SaaS with free/Pro/Enterprise tiers. Free: 1 org,
  3 projects, 5 members. Pro: SSO, KMS, audit retention, batch operations.
  Enterprise: dedicated infra, SLA, on-call, data residency, SOC2 compliance
  reports.
- **Status**: NOT STARTED — Phase 6 deliverable.
- **OSS vs commercial**: OSS self-host is and remains the primary path.
  Cloud is additive; self-host continues to receive all OSS features.
- **Dependencies**: all commercial modules above; billing/entitlement
  service; tenant isolation design; managed infrastructure automation.
