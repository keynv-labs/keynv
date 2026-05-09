---
title: CLI quick reference
description: Every keynv subcommand, with the most common flags and one-line use cases.
sidebar:
  order: 2
---

## Auth

| Command | What it does |
|---|---|
| `keynv login --server URL --email E [--password P]` | Authenticates against a server, persists encrypted credentials to `~/.keynv/credentials.enc`. Password via stdin pipe is recommended. |
| `keynv logout` | Revokes the refresh token server-side, clears the OS-keychain key + credentials file. |
| `keynv whoami` | Prints id, email, org role, and project memberships. |

## Projects

| Command | What it does |
|---|---|
| `keynv project create NAME --env dev --env prod:production:approval` | Creates a project. Env spec is `name[:tier[:approval]]` — tier is `production` or `non-production`; `:approval` requires lead sign-off for developer reads. |
| `keynv project list` | Lists projects you can see. |
| `keynv project describe ID` | Shows environments + tier + approval flag. |
| `keynv project delete ID --force` | Soft-deletes (audit retains). |

## Secrets

| Command | What it does |
|---|---|
| `keynv secret create @P.E.K --stdin` | Reads the value from stdin (recommended) and stores it encrypted. |
| `keynv secret create @P.E.K --value V` | Inline value. Avoid in shell history. |
| `keynv secret get @P.E.K` | Prints the resolved value to stdout. Subject to RBAC + production approval. |
| `keynv secret list PROJECT` | Lists alias names — never values. |
| `keynv secret rotate @P.E.K --stdin` | Creates v(N+1); previous version is immediately marked deleted. |
| `keynv secret delete @P.E.K` | Soft-deletes. |

## Exec — the AI-safety primitive

| Command | What it does |
|---|---|
| `keynv exec -- CMD ...` | Substitutes every `@P.E.K` in CMD's argv with the resolved value at fork-exec time. Subprocess gets a curated env (no agent-shell variables). stdout/stderr stream through the redactor with the resolved values added as literal-match patterns. |
| `keynv exec --via-env DB_PASS=@P.E.K -- node migrate.js` | Resolved value goes into the subprocess env (NAME=value), not argv. |
| `keynv exec --no-redact -- ...` | Disables the redactor. Audit-flagged. |
| `keynv exec --timeout SECONDS -- ...` | Hard kills the subprocess after N seconds. |

## Members (per-project)

| Command | What it does |
|---|---|
| `keynv member add PROJECT EMAIL --role lead\|developer\|reader` | Grants. |
| `keynv member remove PROJECT EMAIL` | Revokes. |
| `keynv member list PROJECT` | Shows current members + roles + when granted. |

## Audit

| Command | What it does |
|---|---|
| `keynv audit list [--event-type T] [--limit N] [--since-id ID]` | Lists entries (paged). |
| `keynv audit verify` | Walks the hash chain server-side; returns OK + count, or the broken-at-id + reason. |

## Connection testing

| Command | What it does |
|---|---|
| `keynv test @P.E.K --as TYPE -t key=value` | Verifies the credential works. The value never leaves the runner; errors are sanitized. Tester types: `postgres`, `mysql`, `redis`, `ssh`, `http`. |

## Redaction

| Command | What it does |
|---|---|
| `keynv redact PATH` | Batch-redacts a file or `-` for stdin. Multi-line patterns (PEM blocks) detected. |
| `keynv redact-stream` | Pipe through stdin; emits redacted text on stdout. Designed as a hook handler. |

## Per-agent integrations

| Command | What it does |
|---|---|
| `keynv install list` | Shows supported integrations. |
| `keynv install AGENT [--dry-run]` | Writes per-agent config (idempotent). |
| `keynv install --all` | Installs every agent detected in the cwd. |
| `keynv uninstall AGENT` | Removes keynv-managed entries. |

`AGENT` ∈ `claude-code` · `cursor` · `opencode` · `codex` · `aider`.
