# Contributing to keynv

Thanks for your interest. keynv is an AI-safe secrets management platform; a few rules below exist because *we are dogfooding our own product on the codebase that builds it*.

## Before you start

- Read [`CLAUDE.md`](./CLAUDE.md) for the project rules. They apply to humans too — the file is named for the AI agent we use day-to-day, but the rules cover anyone touching the code.
- Read the threat model: [`docs/02-threat-model.md`](./docs/02-threat-model.md). Every change touching the safety layer must reference it.
- Check [`docs/roadmap.md`](./docs/roadmap.md) for the active phase + slice tracker. Work outside the in-progress scope is unlikely to land.

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

## Adding a new public route in apps/web

Public routes (anything visitors should reach without a session) need
to be declared in five places. Missing one is a silent bug: the route
will build green locally but visitors will hit a `/login?next=…`
redirect, a 404, or a broken deploy. Run through this list every
time you add a top-level route under `apps/web/app/`:

1. **Middleware** — add the path to `apps/web/middleware.ts`
   `PUBLIC_PATHS` (exact) or `PUBLIC_PREFIXES` (any sub-route).
   Without this the dashboard auth-guard sends visitors to /login.
2. **Robots** — add to `apps/web/app/robots.ts` `allow` list so
   search engines can crawl it.
3. **Sitemap** — add to `apps/web/app/sitemap.ts` so the page is
   discoverable + prioritised correctly.
4. **Metadata** — set page-level `openGraph` / `twitter` / canonical
   in the route's `metadata` export.
5. **Dockerfile (if it reads files at build time)** — if the route
   is `force-static` and calls `readFile` / `readRepoFile` on source
   files outside `apps/web/`, add a `COPY` line for those files in
   `apps/web/Dockerfile` stage 2 (builder). The local build will
   succeed without it; the Coolify build will fail.

This list is here because we forgot one step three times in three
sprints. Sorry to future you.

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

## Deprecation policy

keynv follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html), with a pre-1.0 carve-out:

- **Pre-1.0 (`0.x.y`)**: minor versions (`0.x.0`) may include breaking schema or API changes. Patch versions (`0.x.y`) are backwards-compatible.
- **1.0 onward**: no breaking changes within a major version. Minor versions add features, patch versions fix bugs.

**Public surface** under the SemVer guarantee:

- CLI command names, flags, and exit codes (`keynv <subcommand>`).
- REST API routes and their request/response shapes (`docs/06-api-spec.md`).
- MCP tool names and their input/output schemas (`apps/mcp/src/server.ts`).
- Database schema migrations — once shipped, never edited; downgrades require a new migration with a documented path.
- Cookie names, header names, and error codes (`packages/core/src/errors.ts`).

**Internal surface** can change between any two commits without notice:

- Anything inside `packages/*/src/` not re-exported from the package root.
- Test helpers, fixtures, and the `tests/security/` harness.
- biome / vitest / typescript / drizzle config files.
- The shape of `apps/server/src/db/schema.ts` rows accessed via Drizzle (only the migration is the contract).

**Removing a public-surface feature** requires a deprecation period of at least one minor version after `1.0`:

1. The feature continues to work but emits a runtime warning + a `Deprecation:` HTTP header (REST/MCP) or `keynv ... [DEPRECATED]` stderr line (CLI).
2. The next minor version may remove it. Document the removal in `CHANGELOG.md` under `### Removed`.
3. Pre-1.0, deprecation periods are best-effort. Removals land in the next `0.x.0` with a `### Removed` entry; we will not silently drop a public-surface feature in a patch release even pre-1.0.

**Adding fields** is always backwards-compatible: optional fields default to omitted; required fields require a major version bump (post-1.0) or a minor version bump (pre-1.0).

When in doubt, file an issue before the PR — naming a thing publicly is the single hardest decision to undo.

## Code of Conduct

Project participation is governed by [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree your contributions are licensed under the project's license (see [`LICENSE`](./LICENSE)). Open core is **MIT**, finalized in Phase 5 — see [`docs/decisions/0001-license-choice.md`](./docs/decisions/0001-license-choice.md). Future Phase 6 `packages/ee/*` modules will ship under a separate commercial license in their own subdirectory; contributions to those will require an explicit CLA when that path opens.
