---
title: Getting started
description: Bootstrap a keynv server, log in from the CLI, create a project + secret, run an agent-safe shell command. Five minutes.
sidebar:
  order: 1
---

You will:

1. Bootstrap a self-hosted keynv server (Docker Compose).
2. Log in from the CLI.
3. Create a project + secret.
4. Use `keynv exec --` to run a real command with the alias substituted into argv.
5. Verify the audit chain.

Total time: ~5 minutes.

## Prerequisites

- Docker + Docker Compose
- Node 20+ (for the CLI; native binaries ship in releases)
- macOS, Linux, or WSL2

## 1. Bootstrap the server

```bash
git clone https://github.com/keynv-labs/keynv.git
cd keynv

cp deploy/.env.example deploy/.env
# In deploy/.env, set KEYNV_JWT_SECRET to `openssl rand -base64 32`.
# Litestream creds are optional for local dev — comment the
# litestream service out if you don't have S3 yet.

docker compose -f deploy/docker-compose.yml --env-file deploy/.env build keynv-server

# Bootstrap the org + owner. Password is read from the env, not argv,
# so it doesn't show up in /proc/<pid>/cmdline.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env run --rm \
  -e KEYNV_BOOTSTRAP_PASSWORD='choose-a-strong-12-plus-char-password' \
  keynv-server \
  node dist/bootstrap.js --owner-email lead@team.test --org-name acme

docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d

curl http://localhost:8080/v1/health
# {"ok":true,"version":"...","db":"ok"}
```

## 2. Install the CLI

```bash
# From source (until binaries are published)
pnpm install
pnpm --filter @keynv/cli build:js

# Or run via tsx during development
alias keynv="pnpm --filter @keynv/cli dev"
```

## 3. Log in

```bash
echo 'choose-a-strong-12-plus-char-password' | \
  keynv login --server http://localhost:8080 --email lead@team.test
# logged in as lead@team.test (owner)
```

The first login generates a 32-byte encryption key, stores it in your OS keychain (macOS Keychain / Windows Credential Manager / libsecret on Linux), and writes the encrypted credentials to `~/.keynv/credentials.enc`.

## 4. Create a project + secret

```bash
keynv project create billing --env dev --env prod:production:approval

# stdin is the recommended way to pass values — no shell history, no argv.
echo -n 'super-secret-value-xyz' | \
  keynv secret create @billing.dev.db_password --stdin

keynv secret list billing
# alias                     version  created_at
# @billing.dev.db_password  1        2026-...
```

## 5. Use the secret with `keynv exec --`

```bash
# Without keynv: the password lives in your shell history and the
# agent's tool input.
# mysql -psuper-secret-value-xyz -h db.example.com

# With keynv: the AI agent (and your shell history) sees only the alias.
keynv exec -- echo "mysql will see: -p@billing.dev.db_password"
# mysql will see: -psuper-secret-value-xyz
#
# The argv was substituted at fork-exec time. The agent's tool
# channel records the @alias literal, not the value.
```

To wire `keynv exec` into Claude Code, Cursor, or another agent's bash tool, see the [agent integrations](/integrations/overview/) section.

## 6. Verify the audit chain

```bash
keynv audit list --limit 10

keynv audit verify
# OK: 7 entries verified
```

Every login, project create, secret create, and resolve is hash-chained. Tampering with any historical row breaks every subsequent hash; `keynv audit verify` walks the whole chain (server-side, paginated) and reports the first inconsistency, if any.

## What's next

- [Wire your AI agent](/integrations/overview/) — `keynv install <agent>` writes the per-agent config.
- [Behind a TLS proxy](/deploy/tls-proxy/) — production deployment with Caddy / nginx.
- [Disaster recovery](/deploy/disaster-recovery/) — restore from a Litestream backup if `keynv.db` is lost.
