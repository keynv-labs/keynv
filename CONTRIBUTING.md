# Contributing to keynv

Thanks for your interest. keynv is an AI-safe secrets management platform; a few rules below exist because *we are dogfooding our own product on the codebase that builds it*.

## Before you start

- Read [`CLAUDE.md`](./CLAUDE.md) for the project rules. They apply to humans too — the file is named for the AI agent we use day-to-day, but the rules cover anyone touching the code.
- Read the threat model: [`docs/02-threat-model.md`](./docs/02-threat-model.md). Every change touching the safety layer must reference it.
- Check [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the active phase + slice tracker. Work outside the in-progress scope is unlikely to land.

## Setup

```bash
# Clone
git clone https://github.com/<org>/keynv.git
cd keynv

# Install (pnpm 9, Node 20, Bun 1.x)
pnpm install

# Install git hooks
pnpm dlx lefthook install

# Verify
pnpm lint
pnpm typecheck
pnpm test
```

## Workflow

1. Pick or file an issue in the active phase.
2. Branch from `main`: `git checkout -b feat/<short-name>` (or `fix/`, `docs/`, etc).
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(core): add reference parser`
   - `fix(redactor): handle multi-line RSA blocks`
   - `docs(threat-model): add prompt-injection scenario`
   - `security(server): tighten audit-payload sanitization`
4. Open a PR against `main`. Fill the PR template.
5. Pass CI: lint, typecheck, vitest matrix, gitleaks.
6. Request review from a maintainer of the relevant phase.

## Commit hygiene

- Small, focused commits. One logical change per commit.
- The body explains *why*, not *what*. The code shows the *what*.
- Reference issues with `Closes #123` / `Refs #123`.
- AI-assisted commits: include `Co-Authored-By: <name> <email>` on a final line and disclose the assistant on the PR.

## Code style

- TypeScript only. `any` is forbidden (use `unknown` + narrowing).
- biome enforces lint + format; run `pnpm format`.
- No top-level side effects in library code (`packages/*`). Apps may have entrypoints.
- Do not commit code that requires a comment to be understandable. Naming first; comments only when *why* is non-obvious.

## Security rules (hard)

- Never log a secret value. The pino logger is configured to redact common keys; do not add code that bypasses it.
- Never return raw secret values from MCP tools. Use reference tokens.
- Never write `.env`-style fixtures with real-looking values. Use clearly-fake placeholders (`example-fake-token-do-not-use`).
- Never bypass `gitleaks` (`--no-verify` will be reverted by the maintainer).

If you find a vulnerability, see [`SECURITY.md`](./SECURITY.md). Do not file a public issue.

## Tests

- Unit tests live next to the code (`src/foo.ts` + `src/foo.test.ts`).
- Property tests use [`fast-check`](https://github.com/dubzzz/fast-check). Use them for parsers, encoders, and anything with algebraic invariants.
- Security regression tests live in `tests/security/`. Each row of the threat model has at least one test.
- Run `pnpm test` before pushing; CI will catch the rest.

## Reviews

- Code review is mandatory for `main`.
- Crypto code (`packages/core/src/crypto/`) requires two reviewers from the security maintainer list (Phase 5+).
- Threat model changes require sign-off from a security maintainer.

## Phase discipline

Resist the urge to design for Phase N+2 features today. The threat model is full of "future" risks; we mitigate the ones in the active phase and leave the others as documented gaps. Speculative abstractions slow everyone down and rarely fit when the future arrives.

## Code of Conduct

Project participation is governed by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree your contributions are licensed under the project's license (see [`LICENSE`](./LICENSE)). The license is provisionally MIT; finalization is a Phase 5 deliverable. If we change to Apache-2.0, contributor consent will be sought before the change lands.
