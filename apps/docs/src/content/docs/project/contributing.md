---
title: Contributing
description: We dogfood our own product on the codebase that builds it. The rules are tighter than most projects because of that.
sidebar:
  order: 2
---

The full contributing guide lives at [CONTRIBUTING.md](https://github.com/keynv-labs/keynv/blob/main/CONTRIBUTING.md). The short version:

## Setup

```bash
git clone https://github.com/keynv-labs/keynv.git
cd keynv
pnpm install
pnpm dlx lefthook install      # git hooks: gitleaks + biome + typecheck
pnpm test
pnpm typecheck
```

## Workflow

1. Pick or file an issue in the active phase ([roadmap](/project/roadmap/)).
2. Branch from `main`: `git checkout -b feat/<short-name>`.
3. Conventional commits: `feat(core): add reference parser`.
4. Open a PR against `main`. Pass CI: lint, typecheck, vitest matrix, gitleaks.
5. Get review from a maintainer of the relevant phase.

## Hard rules

- **Never log a secret value.** The pino logger is configured to redact common credential-shaped fields. Don't add code that bypasses it.
- **Never return raw secret values from MCP tools.** Use reference tokens.
- **Never write `.env`-style fixtures with real-looking values.** Use clearly-fake placeholders (`example-fake-token-do-not-use`).
- **`any` is forbidden** (biome `noExplicitAny: error`). Use `unknown` + narrowing.
- **Validate at every boundary.** External input goes through a zod schema before being trusted.
- **Errors carry actionable detail but never carry secret values.** Sanitize `pg`/`mysql2`/etc. driver errors before logging.

## Phase discipline

Resist designing for Phase N+2 features today. The threat model lists many "future" risks; we mitigate the ones in the active phase and document the others as known gaps. Speculative abstractions slow everyone down and rarely fit when the future arrives.

## Crypto code is reviewed twice

Anything under `packages/core/src/crypto/` requires two reviewers from the security maintainer list. The audit chain (`packages/core/src/audit/`) and the redactor (`packages/redactor/`) are also high-scrutiny areas.
