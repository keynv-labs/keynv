# keynv

> AI-safe secrets management. Use aliases in code; AI agents never see real values.

**Status**: Early development (Phase 0 — Discovery & Spike). Not yet usable.

---

## What problem does keynv solve?

Developers leak environment variables, API keys, database passwords, SSH credentials, and tokens constantly. The problem got worse with AI coding agents (Claude Code, OpenCode, Cursor, Codex CLI, Aider): every command they run, every file they read, every diff they show — secrets leak into:

- Tool outputs sent to the LLM provider's logs
- Terminal scrollback
- Shell history
- `.env` files committed to repos
- Process environments enumerable via `env`/`printenv`
- `git diff` / `git log` exposing values committed by mistake

**keynv replaces secret values with aliases.** Your code, configs, and AI agent inputs reference `@billing.prod.db_password`. The actual value lives in a vault and is injected into a privileged subprocess that the AI agent's process tree never sees. Tool outputs are scanned and redacted. AI agents see only the alias literal — never the value.

## Key design choices

- **Agent-agnostic**: works with Claude Code, OpenCode, Cursor, Codex CLI, Aider — no agent-specific lock-in. Per-agent integration installers add deeper isolation where the platform supports it.
- **Reference syntax**: `@project.environment.key` (e.g., `@billing.prod.db_password`)
- **Universal safety layer**: shell wrapper (`keynv exec --`) + MCP server (`keynv-mcp`) + output redactor + per-agent config templates
- **Self-hosted-first**, small-team focus (3–15 people)
- **Open-core** licensing (MIT for the open-source core, commercial for enterprise modules)
- **Tech stack**: TypeScript everywhere — Bun-compiled CLI (single binary), Hono server, SQLite + Litestream, Drizzle ORM, libsodium

## Repository layout

```
keynv/
├── apps/
│   ├── cli/         # `keynv` command (Bun-compiled single binary)
│   ├── server/      # Hono API + SQLite vault
│   ├── mcp/         # `keynv-mcp` MCP server
│   └── web/         # Next.js dashboard (post-MVP)
├── packages/
│   ├── core/        # encryption, reference parser, shared types
│   ├── rbac/        # role + permission engine
│   ├── redactor/    # output / file redaction patterns
│   ├── testers/     # connection testers (postgres, ssh, http, ...)
│   └── integrations/# per-agent setup templates
├── docs/            # architecture, threat model, phase plans
└── deploy/          # docker-compose, helm chart
```

## Roadmap

- **Phase 0** — Discovery & spike (current)
- **Phase 1** — Core vault & CLI
- **Phase 2** — Universal AI safety layer (the killer feature)
- **Phase 3** — Connection testing
- **Phase 4** — Web UI (post-MVP)
- **Phase 5** — Hardening & OSS release
- **Phase 6** — Commercial tier (SSO, HSM, Postgres adapter, SIEM, multi-step approvals)

See [`docs/phases/`](./docs/phases/) for detailed phase plans.

## Documentation

- [`docs/00-vision-and-scope.md`](./docs/00-vision-and-scope.md)
- [`docs/01-architecture.md`](./docs/01-architecture.md)
- [`docs/02-threat-model.md`](./docs/02-threat-model.md)
- [`docs/03-reference-syntax.md`](./docs/03-reference-syntax.md)
- [`docs/04-rbac-and-permissions.md`](./docs/04-rbac-and-permissions.md)
- [`docs/05-encryption-design.md`](./docs/05-encryption-design.md)
- [`docs/06-api-spec.md`](./docs/06-api-spec.md)

## License

To be finalized in Phase 5. The open-source core will be MIT or Apache-2.0; enterprise modules will be commercial.
