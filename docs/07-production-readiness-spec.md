# 07 — Production Readiness Spec

This spec converts the production-readiness review into scoped, implementable
workstreams. It intentionally separates confirmed gaps from capabilities that
already exist but need hardening, documentation, or product polish.

## Status

- Target release: `v0.2.0` for hardening items, `v1.0` for operational maturity.
- Current baseline: `0.1.0-rc.x` self-hosted deployment.
- Scope: core crypto handling, CLI/server workflows, release supply chain,
  operational readiness, and enterprise roadmap prerequisites.
- Non-goal: replacing the documented AI-safety model or changing the primary
  self-hosted deployment path.

## Current Baseline

keynv already provides these foundations:

- REST API namespace under `/v1` with an API specification in
  `docs/06-api-spec.md`.
- Per-project DEKs wrapped by a master KEK, with plaintext secret values never
  persisted at rest.
- Hash-chained audit log with verification endpoints and CLI support.
- Basic approval state machine for production secret reads.
- Multi-environment project creation and server-side environment addition via
  `POST /v1/projects/:id/environments`.
- `keynv init` reconciliation that can add missing environments to an existing
  project during setup.
- In-memory per-user and per-IP rate limiting for the supported single-instance
  self-host topology.
- Basic `/v1/health` endpoint.
- Litestream-oriented backup and restore documentation for self-hosted SQLite.
- Release workflow that publishes CLI binaries, npm package, Docker image, and
  SHA256 checksums.

The work below should therefore avoid re-implementing these foundations and
focus on the missing production guarantees.

## Workstream 1 — Plaintext Memory Handling

### Problem

Secret values currently flow through V8-managed JavaScript strings in both the
server and CLI. The encryption design explicitly documents that JS strings are
immutable and cannot be reliably zeroed on discard. Key material uses
`Uint8Array` / `Buffer`, but plaintext secret values do not.

### Impact

- Plaintext values may remain in process memory until garbage collection.
- Server process memory dumps during request handling can expose secrets.
- High-assurance and regulated deployments cannot claim minimal plaintext
  lifetime in memory.

### Requirements

- Add byte-oriented crypto APIs for secret values, alongside or replacing the
  current string-oriented `encryptSecret` / `decryptSecret` APIs.
- Keep decrypted plaintext as `Uint8Array` or `Buffer` in critical paths until
  the final delivery boundary.
- Explicitly zero plaintext buffers after encryption, decryption, tester use,
  and subprocess environment construction where practical.
- Preserve UTF-8 behavior for normal CLI/API users.
- Document remaining unavoidable string boundaries, such as JSON request and
  response bodies.

### Acceptance Criteria

- Critical crypto paths accept byte arrays for secret values.
- Decrypted plaintext buffers are zeroed in `finally` blocks after use.
- Unit tests verify roundtrip encryption for byte inputs and confirm buffers are
  zeroed after helper execution.
- Threat model and encryption design are updated to describe the new residual
  risk accurately.

Implementation note: `packages/core` now exposes byte-oriented secret crypto
APIs and a `withDecryptedSecretBytes` helper that zeroes decrypted buffers in a
`finally` block. Server secret create/batch/read/rotate/test flows use the byte
APIs at the crypto boundary. JSON request/response bodies and CLI command
arguments remain unavoidable V8 string boundaries and are documented in
[`05-encryption-design.md`](./05-encryption-design.md).

## Workstream 2 — Atomic Batch Secret Uploads

### Problem

`keynv init` uploads discovered secrets sequentially with one POST per secret.
If any upload fails, previously uploaded secrets remain in the vault while later
secrets fail, leaving a partially migrated project.

### Impact

- Bulk migrations can leave inconsistent vault state.
- Users must manually reconcile partial uploads.
- Re-running `init` may hit duplicate-secret failures for the successfully
  uploaded subset.

### Requirements

- Add a server-side batch secret creation endpoint under the existing `/v1`
  project namespace.
- Validate the entire batch before writing any secret rows.
- Persist all secrets in a single database transaction.
- Return per-item validation errors without writing partial data.
- Update `keynv init` to use the batch endpoint when uploading migrated secrets.
- Keep single-secret create behavior unchanged for interactive and scripted use.

### Proposed API

```http
POST /v1/projects/:id/secrets/batch
```

```json
{
  "secrets": [
    { "env": "dev", "key": "db_password", "value": "..." }
  ]
}
```

Success response:

```json
{
  "created": [
    { "alias": "@billing.dev.db_password", "version": 1 }
  ]
}
```

Validation failure response:

```json
{
  "error": {
    "code": "secret.batch_invalid",
    "message": "Batch contains invalid or duplicate secrets.",
    "details": [
      { "index": 0, "code": "secret.already_exists", "key": "db_password" }
    ]
  }
}
```

### Acceptance Criteria

- A batch with one invalid item writes zero secrets.
- A batch with duplicate keys in the request writes zero secrets.
- A batch with an already-existing active secret writes zero secrets.
- `keynv init` reports one consolidated error list and does not write `.keynv.env`
  mappings after a failed batch upload.
- Integration tests cover success, duplicate, missing environment, and rollback
  behavior.

## Workstream 3 — Environment Management UX

### Problem

The server already supports adding environments to an existing project and
`keynv init` can reconcile missing environments during migration. However, users
do not have a dedicated CLI surface for day-to-day environment management, and
the API spec does not document the environment endpoint.

### Impact

- Users may assume environments cannot be added after project creation.
- Operators must use `init` side effects, direct API calls, or project creation
  flags for environment workflows.
- API consumers lack documented behavior for environment creation.

### Requirements

- Document `POST /v1/projects/:id/environments` in `docs/06-api-spec.md`.
- Add CLI commands:
  - `keynv env list --project <name-or-id>`
  - `keynv env add --project <name-or-id> <env-name> [--tier production|non-production] [--approval]`
- Optionally add `keynv env remove` only after a soft-delete design is agreed;
  removal is not part of the initial implementation.
- Reuse existing environment validation schemas and RBAC checks.

### Acceptance Criteria

- Users can list environments for an existing project from the CLI.
- Users can add an environment from the CLI without re-running `init`.
- Duplicate environment creation returns a clear error.
- API spec documents request, response, permissions, and errors.

## Workstream 4 — Release Supply Chain Hardening

### Problem

Release artifacts currently include checksums, but signed binaries, signed
container images, SBOMs, and reproducibility guidance are not implemented.

### Impact

- Users cannot cryptographically verify artifact provenance beyond checksum
  transport integrity.
- Enterprise adopters cannot satisfy common supply-chain audit requirements.
- Responding to dependency CVEs requires manual package inventory work.

### Requirements

- Add cosign keyless signing for CLI binaries and Docker images.
- Generate and publish SBOMs in SPDX or CycloneDX format for release artifacts.
- Publish verification instructions in release notes or docs.
- Keep SHA256SUMS for compatibility.
- Ensure release workflow fails if signing or SBOM generation fails.

### Acceptance Criteria

- Every GitHub Release includes checksums, signatures, and SBOM artifacts.
- Docker images pushed to GHCR are signed and verifiable with cosign.
- Documentation includes copy-paste verification commands.
- CI/security workflow runs dependency scanning before release.

## Workstream 5 — Observability and Health

### Problem

The server exposes basic health status, but production operators lack Prometheus
metrics, OpenTelemetry traces, and separate readiness/liveness semantics.

### Impact

- Operators cannot track latency, error rates, rate-limit activity, or audit
  throughput with standard SRE tooling.
- Incident response and capacity planning are reactive.
- Multi-service deployments cannot correlate keynv latency with upstream calls.

### Requirements

- Add `/v1/health/live` and `/v1/health/ready` or document why the existing
  `/v1/health` remains the only supported endpoint.
- Add a Prometheus-compatible `/metrics` endpoint.
- Track RED metrics for HTTP routes: request count, error count, duration.
- Track domain metrics: secret reads, secret writes, audit appends, approval
  grants/denials, rate-limit rejections.
- Add optional OpenTelemetry instrumentation controlled by environment vars.
- Ensure metrics never include secret values, aliases with sensitive project
  names if configured, or user emails as high-cardinality labels.

### Acceptance Criteria

- `/metrics` returns Prometheus text format.
- Metrics include route-template labels, status class, and method.
- Sensitive labels are excluded or normalized.
- Health endpoint behavior is documented for Docker/Kubernetes probes.

## Workstream 6 — Backup and Disaster Recovery Maturity

Implementation note: the operator runbook is now tracked in
[`backup-restore-runbook.md`](./backup-restore-runbook.md).

### Problem

Self-hosted backup and restore documentation exists, but production operators
need formal RPO/RTO guidance, restore drills, KEK handling procedures, and
failure-mode checklists.

### Impact

- Operators may have backups that have never been tested.
- Master KEK loss or database restore mistakes can make all secrets
  unrecoverable.
- Enterprise review will flag undocumented recovery procedures.

### Requirements

- Expand deployment docs with an operator runbook for backup, restore, and
  verification.
- Define expected RPO/RTO for supported self-hosted topologies.
- Document master KEK backup, rotation, and loss scenarios.
- Add a restore verification checklist that confirms audit-chain integrity and
  sample secret resolution without printing secret values.
- Add guidance for scheduled restore drills.

### Acceptance Criteria

- Docs include step-by-step restore drill commands.
- Docs clearly state what is and is not backed up by Litestream.
- Docs include a KEK loss decision tree.
- Docs include post-restore validation steps.

## Workstream 7 — Rotation Automation

Implementation note: interval metadata, due/overdue discovery, and policy
management are now implemented. See
[`06-api-spec.md`](./06-api-spec.md#patch-v1projectsidsecretsenvkeyrotation-secretrotate)
for endpoint details.

### Problem

Secret rotation is currently manual. Users can rotate individual secrets, but
there is no policy-based scheduling, notification hook, or dependent workload
coordination.

### Impact

- Teams must build their own rotation process.
- Expired or stale credentials may remain active indefinitely.
- Secret rotation can break consumers because the old version is immediately
  marked deleted.

### Requirements

- Add rotation policy metadata per secret or per environment.
- Support due/overdue rotation discovery in CLI and API.
- Add notification hooks for upcoming and completed rotations.
- Design a rotation grace window before implementing automatic rotation that
  affects live consumers.
- Keep manual rotation behavior backward compatible.

### Acceptance Criteria

- Users can list secrets due for rotation.
- Users can configure a rotation interval without changing the secret value.
- Audit logs include policy changes and rotation events.
- Documentation explains manual, scheduled, and grace-window semantics.

## Workstream 8 — API Compatibility Policy

Implementation note: the policy is now tracked in
[`api-compatibility.md`](./api-compatibility.md).

### Problem

The API is namespaced under `/v1`, but production consumers need a clearer
compatibility policy for CLI-server version skew, deprecation timelines, and
breaking changes.

### Impact

- Long-lived integrations cannot safely upgrade without reading code changes.
- CLI and server may become tightly coupled across release candidates.
- Enterprise operators cannot plan maintenance windows confidently.

### Requirements

- Publish a compatibility policy for pre-1.0 and post-1.0 releases.
- Define supported CLI-server version skew.
- Add an endpoint or response field exposing server version and capabilities.
- Document deprecation process and minimum notice period.
- Add compatibility tests for supported CLI/server combinations where feasible.

### Acceptance Criteria

- Docs include a compatibility matrix.
- CLI checks server capabilities before using new endpoints when practical.
- API spec documents versioning and deprecation rules beyond the current `/v1`
  namespace statement.

## Workstream 9 — Enterprise Roadmap Tracking

Implementation note: deferred features are now tracked with individual scope
statements, status, and OSS/commercial delivery notes in
[`roadmap.md`](./roadmap.md#enterprise-feature-tracking).

### Problem

Several enterprise features are correctly deferred to Phase 6, but they need
separate tracking so they do not obscure v0.2 hardening work.

### Deferred Features

- SSO/SAML/OIDC with configurable role mapping.
- HSM/KMS backend support, starting with AWS KMS or Vault Transit.
- Multi-step and multi-party approval workflows.
- SIEM forwarding and audit retention policies.
- PostgreSQL adapter with migrations and connection pooling.
- Data residency and multi-region deployment guidance.
- Break-glass access workflows.
- Official Python and Go SDKs.
- keynv Cloud managed SaaS.

### Acceptance Criteria

- Each enterprise feature has a dedicated issue or roadmap entry.
- The v0.2 hardening milestone does not block on Phase 6 commercial features.
- Documentation clearly distinguishes current self-host OSS behavior from future
  commercial or cloud behavior.

## Implementation Order

1. Workstream 3: Environment management UX and API spec update.
2. Workstream 2: Atomic batch secret uploads.
3. Workstream 4: Release signing and SBOMs.
4. Workstream 5: Observability and health hardening.
5. Workstream 6: Backup/DR runbook expansion.
6. Workstream 8: API compatibility policy.
7. Workstream 1: Plaintext memory hardening spike and incremental refactor.
8. Workstream 7: Rotation automation design, then implementation.
9. Workstream 9: Enterprise roadmap issue split.

This order starts with high-confidence, bounded changes before moving into the
larger memory-safety and rotation designs.

## Validation Strategy

- API changes require server integration tests.
- CLI changes require command tests for success and failure paths.
- Crypto changes require unit tests, negative tests, and explicit review of
  zeroing behavior.
- Release workflow changes require dry-run validation on a test tag or manual
  workflow dispatch before the next public release.
- Documentation-only changes require link and command sanity review.

## Open Questions

- Should batch secret creation be available to all `secret.create` callers or
  limited to admin/init-style workflows?
- Should `/metrics` be unauthenticated for Prometheus scraping, protected by a
  bearer token, or expected to be isolated by network policy?
- Should environment deletion be implemented as a soft delete, or should it be
  blocked while any secrets or audit references exist?
- What is the minimum supported CLI-server skew after `v1.0`?
- Which KMS backend should be the Phase 6 reference implementation?
