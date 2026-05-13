# Getting Started

New to keynv? You are in the right place. This guide walks you from zero to a
working secrets workflow in about 20 minutes. Paths differ depending on how you
plan to run the server.

## Pick your path

| If you… | Follow |
|---|---|
| Have a VPS with Coolify (or Docker) | [Quickstart (Coolify)](./quickstart.md) — fastest path, ~15 min |
| Want Docker Compose | [Docker Compose](#docker-compose) — same steps, different orchestrator |
| Want to just play locally | [Local-only](#local-only) — no server needed for exploration |
| Already have a keynv server running | [Just the CLI](#just-the-cli) — skip server setup |

---

## Docker Compose

If you prefer Compose over Coolify, the repo ships a reference
`deploy/docker-compose.yml` that runs the server + Litestream sidecar.

```bash
git clone https://github.com/keynv-labs/keynv
cd keynv/deploy

# Generate secrets
export KEYNV_JWT_SECRET=$(openssl rand -base64 48)
export KEYNV_MASTER_KEY=$(openssl rand -base64 32)

# Start
docker compose up -d

# Bootstrap the first user
docker compose exec server node dist/bootstrap.js \
  --owner-email alice@example.com \
  --owner-password '<a long random password>' \
  --org-name 'Acme Inc'
```

The server listens on `:8080`. Verify:

```bash
curl http://localhost:8080/v1/health
# {"ok":true,"capabilities":{...}}
```

Then pick up at [Quickstart Step 4](./quickstart.md#4--install-the-cli).

---

## Local-only

For experimentation you can run the server directly on your laptop:

```bash
# From the repo root
pnpm install && pnpm build
export KEYNV_JWT_SECRET=$(openssl rand -base64 48)
pnpm --filter @keynv/server dev
```

In a separate terminal, bootstrap:

```bash
pnpm --filter @keynv/server bootstrap \
  --owner-email dev@localhost \
  --owner-password 'a-local-dev-password' \
  --org-name 'local'
```

Then log in:

```bash
pnpm --filter @keynv/cli dev login --server http://localhost:8080
```

The local server stores its SQLite database at `./keynv.db` and the master key
at `./master.key`. Delete both to reset.

---

## Just the CLI

If someone on your team already deployed the server, you only need the CLI:

```bash
npm install -g @keynv/cli
keynv login --server https://api.keynv.example.com
keynv whoami
```

If you use the hosted version: `keynv login` (no `--server` needed).

---

## CI / CD

For CI pipelines (GitHub Actions, GitLab CI, etc.), use a CLI token instead of
interactive login. Generate one from the web dashboard at
**/settings/account → CLI Tokens**, then:

```bash
export KEYNV_TOKEN=keynv-cli-v1-<your-token>
export KEYNV_SERVER_URL=https://api.keynv.example.com
keynv exec -- <your-build-command>
```

CLI tokens never expire (unless revoked) and carry the same permissions as the
user who issued them. Create separate tokens for CI with the minimum required
project access.

---

## Wiring your AI agent

Once the CLI is installed and logged in, run `keynv init` in any project root.
It scans `.env` files, uploads detected secrets, writes a `.keynv.env` that is
safe to commit, and (optionally) wraps `package.json` scripts with
`keynv exec`.

### Claude Code

`keynv init` creates an `AGENTS.md` (or appends to an existing one) that tells
Claude Code to prefer `keynv exec --`. No further configuration needed.
Restart Claude Code for the changes to take effect.

### OpenCode

Same as Claude Code — `keynv init` handles it. Restart your session.

### Cursor / Windsurf / Copilot

These agents read `.keynv.env` automatically as part of the project context.
The file contains alias references only (`@project.env.key`), so the agent
sees names but never values. Commands that need secrets must go through
`keynv exec --`.

### Generic agent (manual setup)

If your agent doesn't have built-in keynv support:

1. Run `keynv init` to create `.keynv.env` and upload secrets.
2. Configure your agent's "allowed commands" list to include `keynv exec`.
3. When the agent needs a secret, prompt: "Run `keynv exec -- pg_dump -p @myproject.dev.db_pass`".

---

## What to read next

| Document | Purpose |
|---|---|
| [Architecture](./01-architecture.md) | How keynv works under the hood, component topology, data flow |
| [Threat model](./02-threat-model.md) | What keynv defends against (and what it explicitly doesn't) |
| [API specification](./06-api-spec.md) | Full REST API surface for integration builders |
| [Encryption design](./05-encryption-design.md) | Envelope encryption, key hierarchy, crypto primitives |
| [Quickstart](./quickstart.md) | Step-by-step Coolify deployment with exact env vars |
| [Audit findings (Phase 5)](./AUDIT-FINDINGS-PHASE5.md) | Security audit walkthrough and remediation status |
