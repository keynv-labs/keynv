# keynv

> Self-hosted secrets manager for small teams, designed so AI coding agents
> never see your real credentials.

Store your team's API keys, database passwords, and SSH credentials in one
encrypted vault. Reference them everywhere by alias (`@billing.prod.db_password`)
instead of raw values. Roles, audit log, and a CLI that injects the real values
into a privileged subprocess your AI agent's process tree can't read.

```
your code:           keynv exec -- mysql -p@billing.prod.db_password
                                       │
                                       ▼
the AI agent sees:   "@billing.prod.db_password" (just the alias literal)
the database sees:   the actual password (decrypted in a privileged subprocess)
```

---

## Two products in one

**A team secrets manager.** Self-hosted vault on a single SQLite file (Litestream-
backed), envelope-encrypted with libsodium, role-based access control (Owner /
Admin / Developer / Reader), append-only hash-chained audit log, CLI for daily
ops, web UI for team leads (in progress).

**An AI-safety layer on top.** Aliases instead of values everywhere. A shell
wrapper (`keynv exec`) that resolves aliases inside a subprocess your AI agent
can't introspect. An MCP server (`keynv-mcp`) exposing single-use tokens
instead of values. An output redactor that scans every tool result for known
secret patterns + high-entropy strings. Per-agent installers (Claude Code,
Cursor, Codex, OpenCode, Aider) that wire the right hooks and ignore lists.

The two halves use the same vault; you decide how aggressively to lock down
each agent.

---

## Why it exists

Developers leak credentials constantly — `.env` files committed to repos, keys
left in shell history, tokens in tool outputs. AI agents made this worse:
every command, every file, every diff is shipped to a vendor's logs. In 2024
GitHub had 23.7M hardcoded secrets pushed (+25% YoY). Existing vaults
(HashiCorp, Doppler, Infisical, 1Password) are mature but none were designed
around AI agents being permanent residents in your terminal.

keynv's wager: if your code only references `@aliases`, and resolution happens
inside a process the agent can't see, the agent literally cannot leak the
value — even if it tries.

Read [`docs/02-threat-model.md`](./docs/02-threat-model.md) for the full
attack surface analysis.

---

## Quick start

### 1. Deploy the server

Easiest path: **[deploy on Coolify](./deploy/COOLIFY.md)** — about 15 minutes,
auto-bootstraps on first start.

Other options:

- Docker Compose: see [`deploy/README.md`](./deploy/README.md)
- Bare metal / k8s: build with `pnpm --filter @keynv/server build`, run
  `node dist/index.js` behind your own TLS proxy

### 2. Install the CLI

```bash
# from source for now (binary releases are paused — see 'Status' below)
git clone https://github.com/keynv-labs/keynv.git
cd keynv
pnpm install
pnpm --filter @keynv/cli build

# add to PATH (or symlink the bun-compiled binary)
export PATH="$PWD/apps/cli/dist:$PATH"
```

### 3. First secret

```bash
keynv config set server-url https://keynv.your-domain
keynv login --email you@example.com

keynv project create demo
keynv secret create @demo.dev.api_key --value 'whatever'
keynv secret get @demo.dev.api_key
# → whatever
```

### 4. Wire up your AI agent

```bash
# pick whichever you actually use
keynv install claude-code
keynv install cursor
keynv install opencode
keynv install codex
keynv install aider
```

Each one writes the agent-specific config (hooks, ignore lists, MCP entries)
into the current directory. From then on, `keynv exec -- <cmd>` is the safe way
to run anything that needs a real secret.

---

## Status

| Phase | What | State |
|---|---|---|
| 0 | Discovery + monorepo skeleton + spike measurements | done |
| 1 | Core vault: server, CLI, RBAC, audit, encryption | done |
| 2 | AI safety layer: `keynv exec`, `keynv-mcp`, redactor, installers | done |
| 3 | Connection testers: postgres, mysql, redis, ssh, http, AWS, GCP | done |
| 4 | Web UI for team leads (Next.js 15) | in progress |
| 5 | Hardening + public OSS release | not started |
| 6 | Commercial tier: SSO, HSM, Postgres adapter, SIEM | not started |

Versioning is unstable until Phase 5 ships — schemas, APIs, and config formats
may change without backwards-compatibility shims.

---

## Repository layout

```
keynv/
├── apps/
│   ├── cli/         keynv command (Bun-compiled single binary)
│   ├── server/      Hono API + SQLite vault
│   ├── mcp/         keynv-mcp MCP server (stdio + http transport)
│   └── web/         Next.js dashboard (Phase 4)
├── packages/
│   ├── core/        encryption, reference parser, shared types
│   ├── rbac/        role + permission engine
│   ├── redactor/    output / file redaction patterns
│   ├── testers/     connection testers (postgres, ssh, http, …)
│   └── integrations/per-agent setup templates
├── deploy/
│   ├── COOLIFY.md   Coolify deploy guide (recommended)
│   ├── coolify.yml  Coolify-friendly compose
│   └── docker-compose.yml + litestream.yml (manual self-host)
└── docs/
    ├── 00-vision-and-scope.md
    ├── 01-architecture.md
    ├── 02-threat-model.md
    ├── 03-reference-syntax.md
    ├── 04-rbac-and-permissions.md
    ├── 05-encryption-design.md
    ├── 06-api-spec.md
    └── phases/      detailed phase plans + acceptance criteria
```

---

## Tech stack

TypeScript everywhere. Bun for the CLI (single-binary compile), Node 20+ for
the server. Hono for HTTP. SQLite + better-sqlite3 (WAL) with optional
Litestream replication; Drizzle ORM. libsodium-wrappers for crypto.
`@modelcontextprotocol/sdk` for MCP. clipanion for the CLI. zod at every
external boundary. pino for structured logging. biome for lint + format.
vitest + bun:test for tests.

The full stack is locked in [`CLAUDE.md`](./CLAUDE.md) — see "Tech stack
(locked)" and "Hard rules". Those rules apply to humans and AI agents
working in the repo equally.

---

## Documentation

| | |
|---|---|
| [Vision & scope](./docs/00-vision-and-scope.md) | What keynv is and isn't |
| [Architecture](./docs/01-architecture.md) | Components, data flow, trust boundaries |
| [Threat model](./docs/02-threat-model.md) | Attack surface + AI-agent specific vectors |
| [Reference syntax](./docs/03-reference-syntax.md) | The `@project.env.key` format |
| [RBAC & permissions](./docs/04-rbac-and-permissions.md) | The five roles |
| [Encryption design](./docs/05-encryption-design.md) | Envelope encryption, KEK / DEK split |
| [API spec](./docs/06-api-spec.md) | HTTP endpoints |
| [Phase plans](./docs/phases/) | Per-phase deliverables + acceptance criteria |
| [Coolify deploy guide](./deploy/COOLIFY.md) | End-to-end self-host walkthrough |
| [`CLAUDE.md`](./CLAUDE.md) | Working rules for humans and AI agents in this repo |

---

## License

To be finalized in Phase 5. The plan is **MIT** (or Apache-2.0) for the open
core; commercial licensing for any future enterprise modules (SSO, HSM, SIEM
forwarding, multi-step approvals). Until the LICENSE file lands, treat the
repo as "source-available, not yet OSI-licensed" — fine to read, fork, and
self-host; please don't redistribute as a product yet.
