---
title: Agent integrations
description: One command per agent; the integration writes idempotent config that can be cleanly removed. The threat model is uniform; the surface keynv touches differs.
sidebar:
  order: 1
---

The universal AI safety layer (`keynv exec`, `keynv-mcp`, the redactor) works with **any** agent that runs shell commands. The per-agent installers add a tighter integration where the platform supports it: hooks that block `.env` reads, ignore-files that hide credential paths, MCP server registration.

| Agent | Hook denial | Ignore-file | MCP | Doc |
|---|:-:|:-:|:-:|---|
| Claude Code | ✓ `permissions.deny(Read(.env))` + PostToolUse(Bash) → `keynv redact-stream` | — | configurable | [Setup](/integrations/claude-code/) |
| Cursor | — | ✓ `.cursorignore` | — | [Setup](/integrations/cursor/) |
| Aider | — | ✓ `.aiderignore` | — | [Setup](/integrations/aider/) |
| Codex CLI | — | ✓ `.codex/.deny` | — | [Setup](/integrations/codex/) |
| OpenCode | (TBD) | ✓ `.opencode/.keynv-deny` | (TBD) | [Setup](/integrations/opencode/) |

## Pick one and run

```bash
# Detect everything in the current directory and install for all of them
keynv install --all

# Or install one at a time
keynv install claude-code
keynv install cursor
keynv install aider

# Preview without writing
keynv install claude-code --dry-run
```

Re-running the same install is a no-op — the writes are idempotent inside `# >>> keynv >>>` markers in line-based files (`.cursorignore`, `.aiderignore`, …) or under a `__keynv_managed__` tracker key in JSON settings.

## How the per-agent integrations layer with `keynv exec`

The four-layer model: agent shell → `keynv exec` → privileged subprocess → output redactor.

1. **Shell wrapper** (`keynv exec --`): the universal layer. Every agent that runs bash, zsh, or fish can `exec` against keynv with no integration setup. The agent sees only the alias literal in the tool input.
2. **Hooks** (Claude Code today, others as their platforms expose them): block `.env` reads at the file-tool layer; pipe Bash output through `keynv redact-stream` before Claude reads the result.
3. **Ignore-files** (Cursor, Aider, OpenCode, Codex): hide credential paths from the agent's file-tool. Bypassable by a determined agent that lists files manually, but raises the bar significantly for the casual leak.
4. **MCP server** (`keynv-mcp`): for agents that speak the Model Context Protocol. Tools return reference tokens, not values; the tools surface alias names, not metadata that leaks values.

## Removing an integration

```bash
keynv uninstall claude-code
```

`uninstall` removes only what `install` wrote — entries between the `# >>> keynv >>>` markers, or fields tracked under `__keynv_managed__`. Anything you authored manually is preserved.
