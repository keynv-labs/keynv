# Phase 5 — Hardening & OSS Release

**Duration estimate**: 2–3 weeks. **Post-MVP** (after Phase 4, but the OSS release can also follow directly after Phase 3 if Web UI ships separately).

**Goal**: Take the working system and make it ready to be installed by people who didn't write it. Audit the security posture, package the deployment, write the documentation site, set up the licensing, and publish.

**Status**: blocked on Phase 3 (mandatory) and Phase 4 (recommended).

---

## Scope

### Security

- **Internal audit**: read every line of `packages/core/src/crypto/`, `packages/redactor/`, `apps/server/src/auth/`, `apps/cli/src/exec/` against the threat model. Pair-review with at least one external reviewer.
- **Static analysis**: semgrep ruleset for keynv-specific anti-patterns (raw secret in log, missing rbac check, untyped boundary). Snyk/audit-CI for dependencies.
- **Fuzzing**: `fast-check` property tests for parser, redactor, audit chain. Length-bounded fuzz of the regex bank to find catastrophic-backtracking inputs.
- **Penetration test**: red-team scenario — "attacker has dev-machine access" and "attacker has read-only access to backups". Document outcomes.
- **Dependency surface review**: every direct dep in production paths. Justify each. Drop anything not load-bearing.

### Packaging

- **Binaries**: signed binaries for darwin-arm64, darwin-x64, linux-x64, linux-arm64, win-x64. Cosign-signed; install script verifies.
- **Docker**: `keynv/server` and `keynv/litestream` images. Compose stack:
  ```yaml
  services:
    keynv-server: { image: keynv/server, ... }
    litestream:   { image: keynv/litestream, depends_on: [keynv-server], ... }
    nginx:        { image: nginx:alpine, ... }   # TLS termination
  ```
- **Helm chart**: `deploy/helm/keynv/` for k8s users. Single replica still — Postgres/HA is Phase 6.
- **Homebrew tap**: `brew install keynv-labs/tap/keynv` for the CLI.
- **APT/RPM repos**: deferred to Phase 6 unless community demand is high.

### Documentation site

`docs.keynv.dev` (or similar — domain selection part of Phase 5). Astro Starlight. Sections:

- **Getting started** (CLI install, server install, first project).
- **Agent integrations** (one page per: Claude Code, Cursor, OpenCode, Codex CLI, Aider).
- **CLI reference** (auto-generated from clipanion definitions).
- **Server reference** (config keys, env vars, ports, file locations).
- **Threat model** (publish [02-threat-model.md](../02-threat-model.md) verbatim).
- **Deployment guides** (Docker Compose, Helm, systemd, single-VM).
- **Disaster recovery** (Litestream restore, KEK loss).
- **Operations runbooks** (rotation, backup verification, audit chain investigation).
- **Contributing** (architecture overview, test guide, code style).
- **Security policy** (`SECURITY.md`).

### Licensing & legal

- **Open-source core**: MIT or Apache-2.0 (decision in Phase 5). Headers on every source file.
- **Commercial modules**: BSL or proprietary. Lives in `enterprise/` directory (gitignored from the public repo or moved to a private repo).
- **CLA**: lightweight individual + corporate CLA for contributions. CLA-bot on GitHub.
- **Trademark policy**: "keynv" is a trademark; usage guidelines on the docs site.

### CI/CD

- **GitHub Actions** matrix:
  - lint / typecheck / test on Node 20, Node 22, Bun 1.x.
  - test on ubuntu-latest, macos-latest, windows-latest (CLI build only on win).
  - integration test against ephemeral docker-compose (postgres, mysql, redis tester targets).
- **Release workflow**:
  - Tag `vX.Y.Z` triggers binary build + signature + GitHub Release artifact upload.
  - Docker image push to Docker Hub + ghcr.io.
  - Helm chart push to the chart repo.
- **Nightly**: full integration suite + dependency audit + audit-chain stress test.

### Observability

- **Pino → JSON logs** by default; optional Loki/Datadog/CloudWatch shipping in operator config.
- **OpenTelemetry**: spans for HTTP requests + DB queries (no spans inside crypto code, ever, to avoid leaking timing data of value comparisons).
- **Metrics endpoint** `/metrics` (Prometheus format): request counts, p99 latency, audit-write duration, redactor throughput.

### Hardening checklist

- [ ] All dependencies pinned with lockfile.
- [ ] No `any` in production code.
- [ ] All HTTP routes pass through zod validation.
- [ ] Rate limiting configured on auth + read-secret endpoints.
- [ ] Pre-commit: gitleaks + biome + typecheck.
- [ ] CI signs every release artifact.
- [ ] Threat model walked through with reviewer.
- [ ] Documentation site live.
- [ ] License chosen, headers applied, NOTICE file present.
- [ ] `SECURITY.md` with vulnerability disclosure policy.
- [ ] `CODE_OF_CONDUCT.md`.
- [ ] First-pass disaster-recovery exercise: tear down server, restore from Litestream, verify all secrets resolvable.

## Acceptance criteria

- A team unaffiliated with the project can install keynv on a fresh VM, follow the docs, and complete the MVP success-criteria flows from [00-vision-and-scope.md](../00-vision-and-scope.md) within an hour. Documented as a release-readiness exercise with an external user.
- All red-team findings are either resolved or have explicit, documented mitigations.
- All released binaries pass cosign verification.
- The `SECURITY.md` PGP key works, and at least one mock vulnerability report has been processed end-to-end (responder-tested).
- Docs site has zero broken internal links (CI check).

## Risks specific to Phase 5

| Risk | Mitigation |
|---|---|
| Audit reveals significant design flaw | Phase 5 is timed *before* announcement. If audit blocks ship, we delay. |
| OSS release attracts low-quality issues / drive-by PRs | Issue templates + triage doc + bot rules. Maintainer time-budget. |
| Trademark / name collision | Trademark search before launch (keynv unusual enough that risk is low; verified). |
| License choice friction | Settle MIT vs Apache-2.0 in writing in `docs/decisions/`. Community can debate but the call is made. |
| Helm chart / Docker image complexity creep | Single-replica only in Phase 5. HA is explicitly Phase 6 commercial. Documented. |
| Disaster-recovery practice surfaces gaps | The exercise *is* the test. Findings file → backlog. |

## Hand-off to Phase 6

Phase 6 (commercial tier) starts with:
- A live, audited, documented OSS product that real teams can install.
- Telemetry/observability hooks ready for SIEM forwarding.
- A clear license boundary between core and commercial modules.
- A community channel for prioritizing commercial features by demand.
