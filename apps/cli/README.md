# @keynv/cli

> Runtime text-surface protection for AI coding workflows.

[![npm](https://img.shields.io/npm/v/@keynv/cli?color=F59E0B)](https://www.npmjs.com/package/@keynv/cli)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/keynv-labs/keynv/blob/main/LICENSE)

Your AI agent's transcripts, your shell history, and your terminal output are
leaking secrets right now. `keynv` keeps them out, in real time, on your
machine. No cloud, no re-architecting how you work.

```text
$ keynv doctor

  !  zsh history                 5 likely secrets across 1 file
  !  Claude Code transcripts     62,306 likely secrets across 73 files
  ·  Cursor logs                 clean

  Total: 62,311 likely secrets across 74 files.
```

`doctor`, `scrub`, `shell`, and `watch` are fully local — no account, no server,
no network calls. Match previews are bounded to 3 characters; raw secret values
never appear in output.

## Install

```bash
npm install -g @keynv/cli
keynv doctor
```

Prefer a standalone binary over Node? Every
[release](https://github.com/keynv-labs/keynv/releases) publishes signed
executables for macOS / Linux / Windows with a `SHA256SUMS` manifest.

## Quick start

```bash
# 1. Find out where you're leaking (scan only — nothing is rewritten)
keynv doctor

# 2. Clean what's already there (atomic, with backups; --dry-run to preview)
keynv scrub --dry-run
keynv scrub

# 3. Prevent new leaks — a marked hook in your ~/.zshrc / ~/.bashrc / fish
keynv shell install
keynv shell status

# 4. Real-time watcher over Claude Code transcripts + Cursor logs
keynv watch start
keynv watch status
```

The shell hook scrubs secret-shaped substrings before each command lands in
history (POSIX-ERE, no per-command subprocess unless a match fires). The watcher
subscribes to `~/.claude/projects/**/*.jsonl` and Cursor logs via chokidar,
debounces at 1 second, and atomically rewrites matched substrings.

## Aliases (optional — needs a server)

For the "AI agents never see real values" workflow, `keynv` stores secrets in a
vault and hands out aliases (`@project.env.KEY`) instead of values. This needs a
keynv server — self-host in ~15 minutes with the
[Coolify walkthrough](https://github.com/keynv-labs/keynv/blob/main/deploy/COOLIFY.md)
or [Docker Compose](https://github.com/keynv-labs/keynv/blob/main/deploy/README.md).

```bash
keynv login                    # browser flow; session lands in the OS keychain
keynv project create demo
keynv secret create @demo.dev.api_key --value 'whatever'
keynv exec -- npm run dev      # aliases resolved into the child, redacted from output
```

Running `keynv` with no arguments opens an interactive TUI that walks through the
same operations.

## Use with Claude Code / Cursor (MCP)

`keynv` pairs with an MCP server so AI agents can reference secrets by alias and
never see the value. See the
[AI setup guide](https://github.com/keynv-labs/keynv/blob/main/docs/ai-setup.md)
for wiring it into Claude Code, Cursor, and other MCP clients.

## Documentation

- [Getting started](https://github.com/keynv-labs/keynv/blob/main/docs/getting-started.md)
- [AI setup (Claude Code / Cursor / MCP)](https://github.com/keynv-labs/keynv/blob/main/docs/ai-setup.md)
- [What keynv is — and is not](https://github.com/keynv-labs/keynv/blob/main/docs/00-vision.md)
- [Threat model](https://github.com/keynv-labs/keynv/blob/main/docs/02-threat-model.md)
- [Full README](https://github.com/keynv-labs/keynv#readme)

## License

[MIT](https://github.com/keynv-labs/keynv/blob/main/LICENSE) © keynv-labs and contributors
