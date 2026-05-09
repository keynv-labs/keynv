# keynv

> Self-hosted secrets manager with an AI-safety layer. Aliases instead of
> values; AI agents never see real credentials.

Store your team's API keys, database passwords, and SSH credentials in one
encrypted vault. Reference them everywhere by alias (`@billing.prod.db_password`)
instead of raw values. Roles, audit log, and a CLI that injects the real values
into a privileged subprocess your AI agent's process tree can't read.

```text
your code:           keynv exec -- mysql -p@billing.prod.db_password
                                       │
                                       ▼
the AI agent sees:   "@billing.prod.db_password" (just the alias literal)
the database sees:   the actual password (decrypted in a privileged subprocess)
```

> [!NOTE]
> **Two paths in.** Self-host today, or use **keynv Cloud** when it lands.
> Both run the same code; only the operations layer differs.

---

## Two paths

|                       | Self-host (available)                   | keynv Cloud (coming)                  |
| --------------------- | --------------------------------------- | ------------------------------------- |
| **Deploy**            | Coolify / Docker / k8s — 15 min          | sign-up flow                           |
| **Cost**              | $0 (you pay your own infra)              | $0 free tier · Pro tier above          |
| **Limits**            | none                                     | Free: 3 projects × 3 envs × 5 members |
| **Audit retention**   | infinite (your DB)                       | 7 days free · 90 days Pro              |
| **SSO / Approvals**   | Phase 6 commercial module                | Pro tier                               |
| **Secret rotation**   | Phase 6 commercial module                | Pro tier                               |
| **Data sovereignty**  | full (your machine)                      | shared infra (Pro: dedicated option)   |
| **Updates**           | manual `git pull` / Coolify auto-deploy  | rolling, automatic                     |

> [!IMPORTANT]
> **keynv Cloud isn't built yet.** Self-host is the only working path
> today; the Cloud option is what Phase 6 ships. The table above is the
> committed plan, not a marketing fiction — see
> [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the actual delivery state.

---

## Why it exists

Developers leak credentials constantly — `.env` files committed to repos, keys
left in shell history, tokens in tool outputs. AI agents made this worse:
every command, every file, every diff is shipped to a vendor's logs. In 2024
GitHub had **23.7M hardcoded secrets** pushed (+25% YoY). Existing vaults
(HashiCorp, Doppler, Infisical, 1Password) are mature but none were designed
around AI agents being permanent residents in your terminal.

keynv's wager: if your code only references `@aliases`, and resolution happens
inside a process the agent can't see, the agent literally cannot leak the
value — even if it tries.

Read [`docs/02-threat-model.md`](./docs/02-threat-model.md) for the full
attack-surface analysis.

---

## Concepts

### Alias format

`@<project>.<environment>.<key>` — kebab-case segments, e.g.
`@billing.prod.stripe_key`. Detection regex lives in
`packages/core/src/reference/types.ts`. Aliases survive everywhere a string
can: code, configs, shell commands, dotenv files, CI templates.

### Roles

Five-row, project-scoped permission matrix. Lives in `packages/rbac`.

| Role | What they can do |
|---|---|
| **Owner** | Everything; one per org; can rotate the master key |
| **Admin** | Manage projects, members, secrets, audit; can't transfer ownership |
| **Team Lead** | Per-project: add members, rotate secrets, grant production access |
| **Developer** | Read assigned secrets via alias; no UI access to plaintext values |
| **Reader** | Read-only on metadata; can't resolve values |

### Two products in one

Same vault, two surfaces:

- **Team secrets manager** — encrypted SQLite vault, RBAC, append-only
  hash-chained audit, CLI for daily ops, web UI for team leads.
- **AI-safety layer** — `keynv exec` shell wrapper, `keynv-mcp` MCP server,
  output redactor, per-agent installers (Claude Code · Cursor · Codex ·
  OpenCode · Aider).

You decide how aggressively to lock each agent. They share the vault.

---

## Quick start

### Self-host

```bash
# 15-minute Coolify walkthrough — recommended path
open https://github.com/keynv-labs/keynv/blob/main/deploy/COOLIFY.md

# Or plain Docker Compose
open https://github.com/keynv-labs/keynv/blob/main/deploy/README.md
```

After the server is up, install the CLI:

```bash
git clone https://github.com/keynv-labs/keynv.git
cd keynv
pnpm install
pnpm --filter @keynv/cli build
export PATH="$PWD/apps/cli/dist:$PATH"

keynv config set server-url https://keynv.your-domain
keynv login --email you@example.com

keynv project create demo
keynv secret create @demo.dev.api_key --value 'whatever'
keynv secret get @demo.dev.api_key
# → whatever
```

Wire up your agent:

```bash
# pick whichever you actually use
keynv install claude-code   # or: cursor / opencode / codex / aider
```

### keynv Cloud

Star this repo to be notified when sign-up opens. Phase 6 deliverable.

---

## Status

| Phase | What | State |
|---|---|---|
| 0 | Discovery + spike measurements | done |
| 1 | Core vault: server, CLI, RBAC, audit, encryption | done |
| 2 | AI safety layer: `keynv exec`, `keynv-mcp`, redactor, installers | done |
| 3 | Connection testers: postgres, mysql, redis, ssh, http, AWS, GCP | done |
| 4 | Web UI for team leads (Next.js 15) | in progress (slice 9 of ~11) |
| 5 | Hardening + public OSS release | not started |
| 6 | Commercial tier + keynv Cloud | not started |

Versioning is unstable until Phase 5 ships — schemas, APIs, and config formats
may change without backwards-compatibility shims.

---

## Documentation

| | |
|---|---|
| [Threat model](./docs/02-threat-model.md) | What we defend against |
| [Architecture](./docs/01-architecture.md) | Components, data flow, trust boundaries |
| [Encryption design](./docs/05-encryption-design.md) | KEK / DEK split, libsodium primitives |
| [API spec](./docs/06-api-spec.md) | HTTP endpoints |
| [Roadmap](./docs/ROADMAP.md) | Phase status + active slice tracker |
| [Coolify deploy](./deploy/COOLIFY.md) | 15-min self-host walkthrough |
| [`CLAUDE.md`](./CLAUDE.md) | Working rules for humans + AI agents in this repo |

Stack: TypeScript everywhere; Bun for the CLI, Node 20+ for the server, Hono +
SQLite + Drizzle + libsodium. Full lock-list in [`CLAUDE.md`](./CLAUDE.md).

---

## License

Provisional **MIT** for the open core; the LICENSE file lands as a Phase 5
deliverable. Commercial modules (SSO, HSM, SIEM, multi-step approvals) and the
keynv Cloud service ship under separate terms in Phase 6. Until LICENSE
lands, treat the repo as "source-available, not yet OSI-licensed" — fine to
read, fork, and self-host; please don't redistribute as a product yet.
