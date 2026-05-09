---
title: Roadmap (phases)
description: Where keynv is, where it's going, and what's intentionally out of scope.
sidebar:
  order: 1
---

keynv is built in phases. Each phase has a doc in the repository tracking deliverables, acceptance criteria, and known limitations.

## Phase status

| Phase | Status | What ships |
|---|---|---|
| 0 — Discovery & spike | ✅ done | Monorepo skeleton, Bun cold-start measurements, MCP overhead spike, libsodium throughput, SQLite write throughput. |
| 1 — Core vault & CLI | ✅ done | Hono server + SQLite vault + envelope encryption + RBAC + audit hash chain. CLI: login, project, secret, member, audit. |
| 2 — Universal AI safety layer | ✅ done | `keynv exec` privileged subprocess, `keynv-mcp` reference-token MCP server, output redactor (19 patterns + entropy), per-agent installers (Claude Code, Cursor, Aider, Codex, OpenCode). |
| 3 — Connection testing | ✅ done | Pluggable testers (postgres, mysql, redis, ssh, http) + 3-layer error sanitization. CLI `keynv test` and MCP `keynv.test_connection`. |
| 4 — Web UI for team leads | ✅ done | Next.js 15 dashboard (login, projects, secrets, members, audit). UI never displays resolved values. |
| 5 — Hardening & OSS release | 🟡 in progress | Audit-finding cleanup, Docker Compose, lint cleanup, docs site (this!), Helm chart, CI/CD release workflow. |
| 6 — Commercial tier | 📋 planned | Postgres adapter, SSO/SAML/OIDC, HSM/KMS, multi-step approvals, SIEM forwarding, compliance helpers. |

## What keynv is intentionally NOT

- A replacement for HashiCorp Vault. No dynamic secrets, no PKI engine, no transit engine.
- A cloud SaaS. Self-host first; managed hosting is a Phase 6 option, not the MVP.
- A password manager. keynv is for machine credentials (DB passwords, API keys, SSH keys, OAuth client secrets). Use 1Password / Bitwarden for personal credentials.
- A browser autofill tool.

See [Vision & scope](/engineering/00-vision-and-scope/) for the long version.
