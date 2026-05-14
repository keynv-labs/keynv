# Quickstart

Get keynv running and serving its first secret in about 15 minutes.

This guide self-hosts both services on a single VPS using Coolify, then
points the CLI and your AI coding agent at it. If you'd rather skip the
self-host and try the hosted version, sign up at
[keynv.dev/register](https://keynv.dev/register) and pick up at
**Step 4**.

## What you'll need

- A VPS with Docker + Coolify (or any host that can run two Docker
  Compose stacks). 1 vCPU / 1 GB RAM is plenty for a starter team.
- A domain you can point at the VPS (we'll use `keynv.example.com`).
- Node.js 20+ on your laptop, for the CLI.

## 1 · Deploy the server

In Coolify, create a new resource → **Docker Compose Empty** → "From Git
Repository" and point it at:

```
https://github.com/keynv-labs/keynv
deploy/coolify.yml
```

Set the environment variables Coolify asks for:

```bash
KEYNV_JWT_SECRET=<openssl rand -base64 48>
KEYNV_PUBLIC_REGISTRATION=false   # opt-in only; off for self-host
KEYNV_WEB_URL=https://keynv.example.com
COOLIFY_FQDN=api.keynv.example.com
```

Deploy. The healthcheck flips green when the server is listening on
`:8080`. Visit `https://api.keynv.example.com/v1/health` — you should
see `{"ok":true,"capabilities":{...}}`.

## 2 · Deploy the web dashboard

Same Coolify dance, this time with `deploy/coolify-web.yml`:

```bash
KEYNV_SERVER_URL=https://api.keynv.example.com
KEYNV_WEB_SESSION_SECRET=<openssl rand -base64 48>
COOLIFY_FQDN=keynv.example.com
```

Wait for healthy. `https://keynv.example.com` lands on the marketing
page; you'll create your account in the next step.

## 3 · Create the first user

The server auto-bootstraps the owner account on first start. Set
these environment variables in your Coolify resource or `.env`:

```bash
KEYNV_BOOTSTRAP_OWNER_EMAIL=alice@acme.example
KEYNV_BOOTSTRAP_OWNER_PASSWORD=<a long random password>
KEYNV_BOOTSTRAP_ORG_NAME="Acme Inc"
```

Deploy or restart. The server logs:

```text
[auto-bootstrap] created org "Acme Inc" (id=org_...)
[auto-bootstrap] created owner alice@acme.example (id=u_...)
```

Then sign in at `https://keynv.example.com/login`.

## 4 · Install the CLI

On your laptop, hosted keynv is one command:

```bash
npm install -g @keynv/cli
keynv
```

For your self-hosted server, pass the API URL once:

```bash
keynv login --server https://api.keynv.example.com
```

The CLI opens a browser tab to authenticate, stores the session in your OS
keychain, then offers to set up the current project. Verify:

```bash
keynv whoami
# alice@acme.example · owner · Acme Inc
```

## 5 · Create a project and add a secret

```bash
keynv project create billing
keynv secret set @billing.dev.api_key
```

The CLI prompts for the value via stdin (so it never lands in your
shell history). Run `keynv secret list @billing.dev` to verify.

## 6 · Wire your AI coding agent

Run `keynv init` in your project root. It scans existing `.env` files,
uploads detected secrets to the vault, and writes a project-local
`.keynv.env` that maps alias names to vault references. The file is safe
to commit — it contains only alias literals, never raw values.

```bash
keynv init
```

Restart your agent.

## 7 · Use it

In your editor, ask the agent to do something that needs a secret:

> "Run `psql -p @billing.dev.db_password` against the dev database and
> show the schema."

The agent issues the command verbatim. `keynv exec` intercepts,
resolves `@billing.dev.db_password` inside a privileged subprocess the
agent can't read, and only the resolved process sees the real value.
Your terminal shows the redacted output:

```text
psql -p ****** ... (1 row)
```

## What's next

- [Architecture overview](./01-architecture.md) — what's running where.
- [Threat model](./02-threat-model.md) — what keynv defends against and
  what it explicitly does not.
- [API specification](./06-api-spec.md) — full v1 surface for building
  integrations.
