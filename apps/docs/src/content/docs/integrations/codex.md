---
title: Codex CLI
description: Writes .codex/.deny with the canonical credential globs; recommend wrapping invocations with `keynv exec`.
---

## Install

```bash
cd path/to/your/project
keynv install codex
```

Writes a `# >>> keynv >>>` block in `.codex/.deny` listing the keynv credential paths.

## Recommended wrapper

Codex CLI doesn't yet expose a hook surface comparable to Claude Code's. The cleanest approach is to alias `codex` itself through `keynv exec`:

```bash
# In ~/.zshrc or ~/.bashrc
alias codex='keynv exec -- codex'
```

With this alias, every Codex CLI invocation runs in the curated `keynv exec` subprocess, so:

- `@alias` literals in your prompts, scripts, or files are resolved at fork-exec into argv that Codex sees, never values.
- Codex's stdout passes through the redactor — secret-shaped tool outputs get masked.

## Uninstall

```bash
keynv uninstall codex
```

## Limitations

The Codex integration is the lightest of the five — Codex CLI's plugin / hook surface is still evolving, so we ship the deny-list and document the shell-alias pattern. As Codex's API matures we'll add a tighter integration.
