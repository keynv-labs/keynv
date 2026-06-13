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

The full step-by-step guide (config, TLS proxy, ops commands, disaster recovery)
lives in [`deploy/README.md`](../deploy/README.md). Quick summary:

```bash
git clone https://github.com/keynv-labs/keynv
cd keynv/deploy

# 1. configure (fill in JWT secret, owner email/password)
node -e "require('fs').copyFileSync('.env.example','.env')"
# Then open .env in your editor

# 2. start — the server auto-bootstraps on first launch
docker compose --env-file .env up -d

# 3. verify
curl http://localhost:8080/v1/health
# {"ok":true,"version":"...","db":"ok"}
```

The server creates the owner account automatically on first start using the
credentials in `.env`. No manual bootstrap command is needed. See
[`deploy/README.md`](../deploy/README.md) for the expected log output and
the mandatory master-key backup step.

Then pick up at [Quickstart Step 4](./quickstart.md#4--install-the-cli).

---

## Local-only

For experimentation you can run the server directly on your laptop:

On macOS/Linux (bash/zsh):

```bash
# From the repo root
pnpm install

# Build (use build:direct if keynv CLI isn't installed yet)
pnpm build:direct

# Required — server refuses to start without this.
# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
export KEYNV_JWT_SECRET='your-48-byte-base64-secret'

# Bootstrap credentials for the auto-created owner account
export KEYNV_BOOTSTRAP_OWNER_EMAIL='dev@localhost'
export KEYNV_BOOTSTRAP_OWNER_PASSWORD='a-local-dev-password'

pnpm --filter @keynv/server dev
```

On Windows (PowerShell), set the env vars with `$env:` instead:

```powershell
pnpm install
pnpm build:direct

# node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
$env:KEYNV_JWT_SECRET = 'your-48-byte-base64-secret'
$env:KEYNV_BOOTSTRAP_OWNER_EMAIL = 'dev@localhost'
$env:KEYNV_BOOTSTRAP_OWNER_PASSWORD = 'a-local-dev-password'

pnpm --filter @keynv/server dev
```

The server auto-bootstraps the owner account on first start. You will see:

```text
[auto-bootstrap] master key missing — initializing fresh deployment
[auto-bootstrap] created org "default" (id=org_...)
[auto-bootstrap] created owner dev@localhost (id=u_...)
keynv-server listening on http://localhost:8080
```

Then connect from the TUI and choose **Self-hosted server**:

```bash
keynv
```

The local server stores its SQLite database at `./keynv.db` and the master key
at `./master.key`. Delete both to reset.

---

## Just the CLI

If someone on your team already deployed the server, you only need the CLI:

```bash
npm install -g @keynv/cli
# or: pnpm add -g @keynv/cli
keynv
keynv whoami
```

The TUI lets you choose keynv.dev or a self-hosted API URL, then opens your
browser to connect.

---

## CI / CD

For CI pipelines (GitHub Actions, GitLab CI, etc.), use a CLI token instead of
interactive login. Generate one from the web dashboard at
**/settings/account → CLI Tokens**, then:

```bash
export KEYNV_TOKEN=kt_<your-token>
export KEYNV_SERVER_URL=https://api.keynv.example.com
keynv exec -- <your-build-command>
```

`keynv exec` (and every other command) authenticates with `KEYNV_TOKEN` as a
Bearer CLI token against `KEYNV_SERVER_URL`, so no interactive `keynv login` and
no OS keychain are needed in CI.

CLI tokens never expire (unless revoked) and carry the same permissions as the
user who issued them. Create separate tokens for CI with the minimum required
project access.

---

## Wiring your AI agent

Once the CLI is connected, run `keynv` in any project root and choose **Set up
this project**. It scans `.env` files, uploads detected secrets, writes a
`.keynv.env` that is safe to commit, and (optionally) wraps `package.json`
scripts with `keynv exec`.

### Claude Code

The setup flow creates an `AGENTS.md` (or appends to an existing one) that tells
Claude Code to prefer `keynv exec --`. No further configuration needed.
Restart Claude Code for the changes to take effect.

### OpenCode

Same as Claude Code — the setup flow handles it. Restart your session.

### Cursor / Windsurf / Copilot

These agents read `.keynv.env` automatically as part of the project context.
The file contains alias references only (`@project.env.key`), so the agent
sees names but never values. Commands that need secrets must go through
`keynv exec --`.

### Generic agent (manual setup)

If your agent doesn't have built-in keynv support:

1. Run `keynv` and choose **Set up this project** to create `.keynv.env` and upload secrets.
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
| [Audit findings](../AUDIT-FINDINGS.md) · [round 2](../AUDIT-FINDINGS-2.md) | Security audit walkthrough and remediation status |
