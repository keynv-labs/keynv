---
title: OpenCode
description: Writes .opencode/.keynv-deny; full hook/MCP integration is staged for when the OpenCode hook API stabilizes.
---

## Install

```bash
cd path/to/your/project
keynv install opencode
```

Writes a `# >>> keynv >>>` block in `.opencode/.keynv-deny` with the canonical credential globs. The OpenCode integration is intentionally minimal today.

## Status

OpenCode's hook and MCP API surfaces are still evolving as of mid-2026. When they stabilize, the keynv installer will gain:

- Pre/Post tool-use hooks comparable to Claude Code's PreToolUse / PostToolUse model.
- MCP server registration so Codex's tool model can call `keynv.use_secret` and receive a reference token instead of a raw value.

Until then, the recommended pattern is the universal one: prefix invocations with `keynv exec`:

```bash
keynv exec -- opencode chat "fix the migration script"
```

## Uninstall

```bash
keynv uninstall opencode
```

## Track the integration

Watch [GitHub issue #TBD](https://github.com/keynv-org/keynv) for OpenCode hook/MCP integration progress.
