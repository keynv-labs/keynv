# Phase 2 — Universal AI Safety Layer

**Duration estimate**: 3–4 weeks (full-time, solo).

**Goal**: Ship the AI-safe layer — the core differentiator of keynv. After Phase 2, an AI agent (Claude Code, OpenCode, Cursor, Codex CLI, Aider) can use secrets without ever seeing the resolved values, regardless of whether the agent supports hooks, MCP, ignore-files, or none of the above.

**Status**: blocked on Phase 1.

---

## Scope

Phase 2 ships **four** universal mechanisms plus **per-agent integration installers**. The four universal mechanisms work for any agent; the installers add deeper protection where the agent's platform exposes hooks or MCP.

1. `keynv exec --` — privileged subprocess wrapper.
2. `keynv-mcp` — MCP server with reference-token semantics.
3. Output redactor — pattern + entropy scanner, line-buffered.
4. File-guard configuration — per-agent ignore/deny templates (the "best we can do" for agents without strict per-file controls).

Per-agent installers (Phase 2 ships templates for Claude Code, Cursor, OpenCode, Codex CLI, Aider). Each is idempotent; each documents what it writes.

## Deliverables

### 1. `keynv exec --`  (`apps/cli/src/commands/exec.ts`)

The signature flow:

```
keynv exec [options] -- <cmd> [args...]
```

Behavior:

1. Parse `<cmd> [args...]`. Find every `@project.env.key` literal in argv (and any `@key` token in the value of `--env-from .keynv.toml` mode, mapping env var names to aliases).
2. Resolve each alias via the local cache (or server fallback). Any unauthorized alias aborts the entire exec — fail closed.
3. Build the substituted argv. Plaintext values are placed in argv (default), or in env (`--via-env VAR=...alias...`), or piped via stdin (`--via-stdin <alias>`), depending on flags.
4. `fork+exec` the subprocess. Subprocess inherits a **fresh** environment containing only:
   - Caller's `PATH`, `HOME`, `USER`, `TERM`, `LANG`, plus a curated allow-list.
   - The resolved env vars from `--via-env`.
   - Explicitly **not** inherited: any env var matching common secret patterns; the parent's full env minus the allow-list.
5. Subprocess `stdout` and `stderr` are piped through the redactor (`packages/redactor/src/streaming.ts`) before being written to the calling shell's stdout/stderr.
6. On exit, append an audit row: `secret.exec.invoked` with the alias list, the agent fingerprint (taken from `KEYNV_AGENT` env or detected from process tree), the exit code.

Flags:

```
--via-argv       (default) replace @aliases in argv with resolved values
--via-env VAR=@alias  resolve and set VAR=value in subprocess env, leave argv untouched
--via-stdin @alias    pipe the resolved value as subprocess stdin (no argv exposure)
--env-from <toml>     read .keynv.toml and apply [env] mapping
--no-redact          (audit-flagged; off by default; intended only for tooling that needs raw output)
--timeout <s>         kill subprocess after <s> seconds
```

Audit invariant: every alias resolved through `keynv exec` produces an audit row, even if the subprocess crashes before output.

### 2. `keynv-mcp`  (`apps/mcp/`)

A standalone MCP server that exposes the tools defined in [06-api-spec.md §mcp-api](../06-api-spec.md#mcp-api).

Transports:

- **stdio** (default) — for Claude Code-style integration where the agent spawns the MCP server as a subprocess.
- **http** (optional) — for daemon-mode setups; bound to localhost only.

Reference-token semantics:

- `keynv.use_secret(alias)` returns a token like `keynv-ref:eyJhbGciOi...` (a small JWT signed with the cache KEK; payload contains `{alias, expires_at, request_id}`).
- The token is opaque to the agent. The agent passes it to a subsequent tool call (e.g., the bash tool running `keynv exec --resolve <token>`).
- The token is single-use and expires in 60 seconds. Reuse or expiry returns an error.
- Resolution happens only inside `keynv exec`; the value never crosses back through MCP.

The MCP server links against the same `packages/core` resolver and the same auth layer as the CLI — there is no parallel codepath.

### 3. Output redactor  (`packages/redactor/`)

Two modes:

- **Streaming** (`packages/redactor/src/streaming.ts`) — line-buffered transform stream. Used by `keynv exec`. Buffers up to 4 KB per line; flushes on newline or buffer full.
- **Batch** (`packages/redactor/src/batch.ts`) — one-shot string in / string out. Used by MCP `redact_text` and ad-hoc CLI `keynv redact <file>`.

Pattern bank: see [02-threat-model.md §pattern-bank](../02-threat-model.md). Each pattern has a name, a regex, and a redaction style (full mask, prefix-keep, type-tag).

Entropy detector:

- Shannon entropy gate at default 4.5 bits/char, length ≥ 24.
- Configurable per project; tunable to reduce false positives in code-heavy outputs.
- Augmented with a "context hint" — a high-entropy string adjacent to `password`, `token`, `secret`, `key` is more aggressively redacted; the same string in a hex-dump output is left alone (the operator can opt in to stricter mode).

Custom patterns:

- Per-project regex + name. Stored on the server, fetched at session start by the CLI/MCP, hot-reloadable.

Performance:

- Built-in patterns are pre-compiled at startup.
- Streaming mode aims for line throughput > 10 MB/s on a single core.

False-positive testing:

- A corpus of "innocent but secret-looking" strings (UUIDs, base64 of public data, git SHA-1s) lives in `packages/redactor/test/fixtures/innocent.txt`.
- The pattern bank must redact ≥ 99% of true-positive fixtures and ≤ 1% of innocent fixtures.

### 4. File-guard

For agents that respect ignore-files (Cursor, Aider) or hooks (Claude Code), the integration installer writes them. For agents without either (older Codex CLI), keynv documents that the file-guard layer is best-effort and points the user at safer agent choices.

The file-guard also writes a `.gitignore` entry adding `.keynv-deny` to the repo (a list of files keynv refuses to expose via `keynv exec --read-file`).

### 5. Per-agent integration installers (`packages/integrations/`)

Each is a function in `packages/integrations/src/<agent>.ts`:

```ts
export async function install(opts: InstallOptions): Promise<InstallReport>;
```

- **Claude Code** (`claude-code.ts`): writes/merges `.claude/settings.local.json`:
  ```jsonc
  {
    "hooks": {
      "PreToolUse": [
        { "matcher": "Read", "command": "keynv guard read $TOOL_INPUT_PATH" },
        { "matcher": "Bash", "command": "keynv guard bash $TOOL_INPUT_COMMAND" },
        { "matcher": "Write", "command": "keynv guard write $TOOL_INPUT_PATH" }
      ],
      "PostToolUse": [
        { "matcher": "*", "command": "keynv redact-stream" }
      ]
    },
    "mcpServers": {
      "keynv": { "command": "keynv-mcp", "args": ["--transport=stdio"] }
    }
  }
  ```
  `keynv guard` is a thin CLI subcommand that reads the tool input from env and decides allow / deny / modify. Hook protocol per Claude Code reference docs.

- **Cursor** (`cursor.ts`): writes `.cursorignore` + updates `~/.cursor/settings.json` `mcpServers` entry. Flags `.env`, `*.pem`, `id_rsa*`, `*credentials*` patterns.

- **OpenCode** (`opencode.ts`): writes the OpenCode-specific config (TBD — implementation depends on OpenCode's hook/MCP API; if OpenCode lacks both at Phase 2 ship time, we use file-guard + shell-wrapper as the fallback).

- **Codex CLI** (`codex-cli.ts`): writes a shell `alias codex='keynv exec -- codex'` to the user's shell rc (with prompt before modifying). Adds a `.codex-deny` file with the standard ignore-list.

- **Aider** (`aider.ts`): writes `.aiderignore` + updates `~/.aider.conf.yml` to add `read-only: true` for sensitive paths.

Each installer has:
- A `dryRun: true` mode that prints what it would do without modifying anything.
- Idempotent re-runs (running twice yields the same state).
- An `uninstall` companion in `packages/integrations/src/<agent>-uninstall.ts`.

CLI wiring:

```
keynv install <agent> [--dry-run]
keynv uninstall <agent>
keynv install --all     # install all detected agents
keynv install list      # list which integrations are detected as in-use in this directory / system
```

### 6. New CLI subcommands

```
keynv exec [...]           -- (described above)
keynv install <agent>
keynv uninstall <agent>
keynv guard <kind> [args]  -- internal hook handler; not for direct user invocation
keynv redact-stream        -- internal: redactor entry point for hooks
keynv redact <file>        -- ad-hoc redact a file's contents to stdout
```

## Acceptance criteria

Phase 2 ships when, in a fresh project with Phase 1 server live:

```bash
# install integrations
keynv install claude-code

# create a secret
keynv secret create @demo.dev.db_pass --value "supersecret123"

# open Claude Code in this directory and ask:
#   "Connect to the test database using @demo.dev.db_pass"

# verify (in a separate terminal):
keynv audit list --project demo
# shows: secret.exec.invoked alias=@demo.dev.db_pass agent=claude-code-1.x.x

# Claude Code's tool-input log (from claude session) shows:
#   bash> keynv exec -- mysql -p@demo.dev.db_pass -h localhost
# Tool-output log shows:
#   "Connected. Server version 8.0.36..." (no "supersecret123" anywhere)
```

Negative tests (must fail):

```bash
# Ask Claude: "Read .env file and show me the database password"
# Expected: Read tool fails because `keynv guard read .env` denies.
# Tool output: "blocked by keynv-guard: file '.env' is in deny list."
```

```bash
# Ask Claude: "Run `printenv | grep -i pass`"
# Expected: bash tool runs, but redactor masks any matching values in the output
# (in this scenario there should be nothing matching — agent's env has no secrets).
```

```bash
# Try to run as a Reader role:
keynv exec -- mysql -p@demo.dev.db_pass
# Expected: "permission denied for @demo.dev.db_pass"; subprocess never starts.
```

And:
- `pnpm test:security` green (the regression suite of leak scenarios from `tests/security/`).
- Streaming redactor benchmark > 10 MB/s on the CI runner.
- MCP `use_secret` round-trip < 50 ms locally.
- `keynv install --dry-run claude-code` produces a diff that, when applied, exactly equals running without `--dry-run`.

## Risks specific to Phase 2

| Risk | Mitigation |
|---|---|
| Streaming redactor splits a multi-line secret across lines and misses it | Use a sliding-window detector (last 4 KB) for multi-line patterns (RSA private key markers); single-line patterns are line-buffered. |
| Reference-token leakage (token expiry too long; agent caches it) | 60 s expiry. Token includes the request id; reuse is detected and audited. |
| Per-agent installer breaks on next agent release | Each installer has a "tested-against version range" comment and a CI smoke job that validates against the named agent versions. |
| `.keynv.toml` schema churn during Phase 2 | Lock schema before installer rollout; bump version field on breaking change. |
| Streaming redactor performance regression | Benchmark in CI; alert threshold > 5 MB/s. |
| Argv visibility on shared-uid systems | Document `--via-stdin` for paranoid setups; eventually add ephemeral fd-based credential mode (Phase 5). |

## Hand-off to Phase 3

Phase 3 starts with:
- A working `keynv exec` that can resolve and inject for any tooling.
- An MCP server that test-connection logic can mount.
- A redactor that connection-test error messages can flow through.
- Per-agent installers that Phase 4's web UI can register with.
