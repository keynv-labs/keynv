# CLAUDE.md — keynv project guide

You are working on **keynv**, an AI-safe secrets management platform. The product itself exists to prevent AI coding agents (you, in this session, are one of them) from leaking developer secrets. Read this carefully — the rules below are stricter than most projects because *we are dogfooding our own product*.

## Project overview

keynv lets developers store secrets (DB passwords, API keys, SSH credentials) in a self-hosted vault, then reference them by alias (`@project.env.key`) in code, configs, and shell commands. A privileged shell wrapper and MCP server inject the real value into subprocesses that the AI agent's process tree never sees. Tool outputs are scanned and redacted before being returned to the agent.

For full context read in this order:
- [`README.md`](./README.md) — product positioning + quick start
- [`docs/01-architecture.md`](./docs/01-architecture.md)
- [`docs/02-threat-model.md`](./docs/02-threat-model.md)
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — phase status + active slice list

The master plan that produced these docs lives at `~/.claude/plans/geli-tiriciler-s-rekli-env-leri-gleaming-bentley.md` (outside this repo).

## Tech stack (locked)

- TypeScript everywhere
- **CLI**: Bun runtime, compiled to single binary via `bun build --compile`
- **Server**: Node 20+, Hono framework
- **Database**: SQLite (better-sqlite3, WAL mode) + Litestream for backup. *Postgres is a Phase 6 commercial adapter; do not introduce it earlier.*
- **ORM**: Drizzle (SQLite dialect first, Postgres dialect later)
- **Crypto**: libsodium-wrappers + age-encryption
- **MCP**: `@modelcontextprotocol/sdk`
- **CLI parser**: clipanion
- **Validation**: zod (at every external boundary)
- **Logging**: pino (structured)
- **Lint/format**: biome (single tool — do not add ESLint or Prettier)
- **Test**: vitest + supertest (Node), bun:test (Bun-side)
- **Web UI** (Phase 4): Next.js 15 + Tailwind + shadcn/ui

## Hard rules (do not violate)

### Security rules

1. **Never log a secret value.** Logs may contain alias names (`@project.env.key`) but never resolved values. Use the structured logger (pino) — it has a redactor configured.
2. **Never return raw secret values from MCP tools.** `keynv-mcp` `use_secret(alias)` returns a single-use reference token, not the value. Resolution happens only inside the privileged subprocess wrapper.
3. **Never write `.env`-style files containing real values** anywhere in this repo or in test fixtures. Tests must use throwaway fakes generated at runtime.
4. **Never commit fixtures containing real-looking secrets** — even fake ones can train developers to ignore leaks. Use clearly-fake placeholders (`example-fake-token-do-not-use`).
5. **Never bypass the redactor in tests.** If a test needs to assert on a secret-shaped value, use the redactor's `inspect()` debug API; do not disable redaction.
6. **Subprocess argv must not contain resolved values when the agent's process can read them.** When in doubt, use stdin or a temporary file with restrictive permissions.

### Process rules

7. **Don't introduce dependencies casually.** Before adding a new package: check if `packages/core` or an existing dep already provides it. Justify additions in the PR description.
8. **Don't add backward-compatibility shims** for code that hasn't shipped yet. The public surface is undefined until Phase 5.
9. **Don't write speculative abstractions.** Three concrete uses before extracting a helper. The threat-model doc is full of "future" risks; resist designing for hypothetical Phase 6 features in Phase 1.
10. **Never run destructive commands** (`rm -rf`, `git reset --hard`, `git push --force`, dropping tables/databases) without explicit user confirmation.
11. **Never bypass git hooks** (`--no-verify`). The pre-commit hook runs gitleaks; if it flags something, investigate.
12. **Never store credentials in `~/.keynv/` plaintext.** Use OS keychain (macOS Keychain / Windows Credential Manager / libsecret on Linux) via the `keytar` or equivalent abstraction.

### Code quality rules

13. **Default to no comments.** Add a comment only when *why* is non-obvious. Never explain *what* — naming should do that.
14. **`any` is forbidden.** Use `unknown` + type narrowing, or define the actual type. The biome `noExplicitAny` rule is set to `error`.
15. **Validate at every boundary.** External input (HTTP, CLI args, MCP tool params, env vars) must pass through a zod schema before being trusted internally.
16. **Errors carry actionable detail** but **never carry secret values** in their messages or `cause` chain. Sanitize `pg`/`mysql2` driver errors before logging.
17. **Use `import type` for type-only imports** (biome enforces this).
18. **Prefer SQL via Drizzle's typed builder** over raw `sql\`` template strings, except for performance-critical hot paths (document why).

## Working style

- Check [`docs/ROADMAP.md`](./docs/ROADMAP.md) before changing anything in `apps/` or `packages/`. It lists what's shipped, what's in progress (Phase 4 slice tracker), and what's deliberately not started yet. If a change crosses phase boundaries, flag it.
- Use `pnpm test` and `pnpm typecheck` locally before claiming a task done.
- For UI work in Phase 4+, also run the dev server and click through the change yourself; don't rely on type-check alone.
- When you find yourself pattern-matching on secrets in code (e.g., adding a new redactor pattern), add a regression test in `packages/redactor/test/patterns.test.ts`.

## Tool-use guidance for AI agents (you)

- The codebase contains test fixtures that *look* like secrets but are not (e.g., `example-fake-token-do-not-use`). Treat them as opaque strings; do not try to "resolve" them.
- If a tool result contains real-looking sensitive values, *flag it to the user* — that's likely a leak and should be reported, not used.
- Prefer `keynv exec --` even in development scripts. Eat your own dogfood; if `keynv exec` is awkward in some flow, that's a UX bug to file, not to work around.
- The `~/.claude/settings.local.json` (or `.claude/settings.json` in this repo, once Phase 2 ships an `keynv install claude-code` template) will deny `Read` on `.env*`, `*.pem`, `id_rsa*`. If a tool fails with "blocked by keynv-guard", do not try to work around it.

## Quick orientation commands

```bash
# Build everything
pnpm build

# Run tests across the monorepo
pnpm test

# Run typecheck without emitting
pnpm typecheck

# Lint + format (biome)
pnpm lint
pnpm lint:fix
pnpm format

# Per-package work (example: CLI)
pnpm --filter @keynv/cli dev
pnpm --filter @keynv/cli test

# Run the dev server stack (Phase 1+)
pnpm --filter @keynv/server dev
```

## Glossary

- **alias**: A reference to a secret in the form `@project.env.key`.
- **DEK**: Data Encryption Key. One per project; encrypts the secret value.
- **KEK**: Key Encryption Key. Master key that encrypts each project's DEK. Lives in OS keychain locally; in HSM/KMS in commercial tier.
- **redactor**: The pattern + entropy scanner that masks secrets in tool outputs before they reach the AI agent.
- **safety layer**: The combination of `keynv exec`, `keynv-mcp`, and the redactor.
- **integration installer**: Per-agent config writer (`keynv install claude-code`, `keynv install cursor`, ...).
- **privileged subprocess**: Subprocess spawned by `keynv exec` that has the real secret values in its env/argv/stdin but does NOT inherit the AI agent's fd/env/cwd.
