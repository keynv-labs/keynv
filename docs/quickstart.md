# Quickstart

Get keynv running and serving its first secret in about 15 minutes.

This guide self-hosts keynv — the API server and the web panel — as one
Coolify resource, then points the CLI and your AI coding agent at it.

## What you'll need

- A VPS with Docker + Coolify. 1 vCPU / 2 GB RAM is plenty for a starter team.
- A domain you can point at the VPS (we'll use `keynv.example.com`).
- Node.js 20+ on your laptop, for the CLI.

## 1 · Deploy (server + panel)

In Coolify, create a new resource → **Docker Compose Empty** → "From Git
Repository" and point it at:

```
https://github.com/keynv-labs/keynv
deploy/coolify.yml
```

Set the **only two values you must provide** — the first owner account:

```bash
KEYNV_BOOTSTRAP_OWNER_EMAIL=alice@acme.example
KEYNV_BOOTSTRAP_OWNER_PASSWORD=<a 12+ char password>
```

Everything else — the JWT secret, master key, and web session secret — is
auto-generated and persisted on the volumes on first boot. Under the
resource's **Domains** tab, map the two services:

- `keynv-web` → `https://keynv.example.com` (port `3000`) — the panel
- `keynv-server` → `https://api.keynv.example.com` (port `8080`) — the API

Deploy. When the server's readiness probe is green:

```bash
curl https://api.keynv.example.com/v1/health/ready
# {"ok":true,"version":"...","db":"ok",...}
```

The deploy log shows the owner being created:

```text
msg: "created owner" email: "alice@acme.example"
```

For the full Coolify walkthrough (master-key backup, troubleshooting), see
[`deploy/COOLIFY.md`](../deploy/COOLIFY.md).

## 2 · Sign in

Open `https://keynv.example.com/login` and sign in with the owner account
you just set. Invite teammates from `/admin/users` (public signup is off by
default; flip `KEYNV_PUBLIC_REGISTRATION=true` to open it).

## 3 · Install the CLI

On your laptop, install the CLI and open the TUI:

```bash
npm install -g @keynv/cli
keynv
```

The TUI lets you choose a self-hosted API URL, opens a browser tab to
authenticate, stores the session, then offers to set up the current project.
Verify:

```bash
keynv whoami
# alice@acme.example · owner · Acme Inc
```

> On a headless Linux box without an OS keychain, export
> `KEYNV_DISABLE_KEYCHAIN=1` before logging in so credentials persist to a file.

## 4 · Create a project and add a secret

```bash
keynv project create billing
keynv secret create @billing.dev.api_key
```

The CLI prompts for the value via stdin (so it never lands in your shell
history). Run `keynv secret list billing` to verify.

## 5 · Wire your AI coding agent

Run `keynv` in your project root and choose **Set up this project**. It scans
existing `.env` files, uploads detected secrets to the vault, and writes a
project-local `.keynv.env` that maps alias names to vault references. The file
is safe to commit — it contains only alias literals, never raw values.

Restart your agent.

## 6 · Use it

In your editor, ask the agent to do something that needs a secret:

> "Run `psql -p @billing.dev.db_password` against the dev database and show
> the schema."

The agent issues the command verbatim. `keynv exec` intercepts, resolves
`@billing.dev.db_password` inside a privileged subprocess the agent can't
read, and only the resolved process sees the real value. Your terminal shows
the redacted output:

```text
psql -p <REDACTED:literal-alias-resolved-value> ... (1 row)
```

## What's next

- [Architecture overview](./01-architecture.md) — what's running where.
- [Threat model](./02-threat-model.md) — what keynv defends against.
- [API specification](./06-api-spec.md) — full v1 surface for integrations.
