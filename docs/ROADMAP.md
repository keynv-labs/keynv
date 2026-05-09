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
| **4** | Web UI for team leads | ◐ in progress (slice 9 of ~11) |
| **5** | Hardening & public OSS release | ○ not started |
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
- `keynv-mcp` MCP server (stdio + http) that returns single-use reference
  tokens, never values
- Output redactor (regex + Shannon entropy) for tool results
- Per-agent integration installers: Claude Code, Cursor, OpenCode, Codex,
  Aider — each writes the right hooks / ignore lists / MCP wiring

## Phase 3 — Connection testers · DONE

`packages/testers` adapter pattern with built-ins for postgres, mysql,
redis, mongodb, ssh, http (basic / bearer / oauth2), AWS IAM
(`sts:GetCallerIdentity`), GCP service-account, Azure SP. `keynv test
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
| 10 | Connection tester + `/projects/[id]/status` board | ○ |
| 11 | Approvals state machine + `/projects/[id]/approvals` | ○ |

UX direction is locked in [`apps/web/REDESIGN.md`](../apps/web/REDESIGN.md)
(Linear / Raycast / Arc dark-first density).

## Phase 5 — Hardening & public OSS release · NOT STARTED

Pre-public-launch: third-party security audit (semgrep + snyk + custom
recipes), Astro Starlight docs site (separate repo), single-binary
release pipeline (Bun-compiled CLI, multi-arch Docker, Helm chart),
licensing finalization (currently provisional MIT — see
[`docs/decisions/0001-license-choice.md`](./decisions/0001-license-choice.md)),
self-hosted onboarding wizard.

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
