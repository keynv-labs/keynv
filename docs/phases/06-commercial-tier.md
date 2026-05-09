# Phase 6 — Commercial Tier

**Duration estimate**: ongoing. Sequencing of submodules driven by customer demand.

**Goal**: Build the modules that mid-size and enterprise teams will pay for, on top of the open-core baseline. Each commercial module lives in `enterprise/` (private repo or gitignored) and links cleanly through documented interfaces in the open-source core.

**Status**: blocked on Phase 5.

---

## Modules

The Phase 6 backlog is unordered; sequence is set by paying customers' demand.

### M1. Postgres adapter

**What**: replace SQLite with PostgreSQL for installations that need multi-instance HA, read-replica fanout, or external backup tooling.

**How**: a Drizzle dialect swap. `apps/server/src/db/index.ts` is the single insertion point; the schema is dual-targeted from the start.

**Operational delta**:
- Replication via Postgres streaming replication or logical replication.
- Backup via pgBackRest / wal-g.
- Litestream is not used in this mode.

**Why commercial**: scale > 50 users / multi-region is enterprise.

### M2. SSO / SAML / OIDC

**What**: integrate with Okta, Azure AD, Google Workspace, Auth0, generic OIDC. Replaces email/password login with SSO; refresh tokens become SAML/OIDC tokens.

**How**: a pluggable `AuthAdapter` in `apps/server/src/auth/adapters/`. Each adapter handles the provider's specifics (SAML AuthnRequest, OIDC code flow, JWT claim mapping).

**Why commercial**: SSO is the table-stakes enterprise feature.

### M3. HSM / KMS integration

**What**: store the master KEK in AWS KMS, GCP KMS, HashiCorp Vault Transit, or a hardware HSM (PKCS#11). The server never holds the KEK in process memory directly — every wrap/unwrap is a round-trip to the KMS.

**How**: `KekProvider` interface in `packages/core/src/crypto/kek-provider.ts`. The OSS core ships `LocalFileKekProvider`; commercial ships `AwsKmsKekProvider`, `GcpKmsKekProvider`, `VaultTransitKekProvider`, `Pkcs11HsmKekProvider`.

**Why commercial**: compliance frameworks require key custody outside application code.

### M4. Multi-step approval workflows

**What**: M-of-N approvals for production-tier secret reads. E.g., "any 2 of [lead-1, lead-2, sec-officer]" must approve.

**How**: extend the approval model to support quorums; UI updates to surface multi-approver state.

**Why commercial**: SOX/PCI-DSS-style separation of duties.

### M5. SIEM forwarding

**What**: ship audit events to Splunk HEC, Datadog Logs, OpenTelemetry, or a generic webhook in real time.

**How**: a sidecar / in-process exporter that watches the `audit` table's hash chain and posts events. Backpressure-aware; drops to local-disk queue if downstream is unreachable.

**Why commercial**: required by enterprise security teams.

### M6. Compliance helpers

**What**: tooling to produce SOC2 / ISO27001 / HIPAA audit-ready reports from the audit log.
- Quarterly access review export.
- Privileged-access-management report.
- Secret rotation history with proof-of-rotation timestamps.

**How**: report templates + a CLI/UI to run them.

**Why commercial**: auditors specifically ask for these artifacts.

### M7. Multi-region replication

**What**: keynv-server in two or more regions, each with read access to all data, writes funneled through a primary. Failover is operator-driven (not automatic).

**How**: Postgres streaming replication + leader-election out-of-band. Consul-style coordination optional.

**Why commercial**: latency-sensitive global teams.

### M8. Secret rotation cascade

**What**: when a secret rotates, automatically update consumers — Kubernetes secrets, GitHub Actions variables, CI vars, Terraform state, Vault namespaces, etc.

**How**: a `RotationConsumer` interface; commercial ships consumers for k8s, GHA, GitLab CI, Terraform Cloud, Vault. Each consumer is a small adapter that knows how to push the new value to that target.

**Why commercial**: ergonomic feature with significant integration surface; reduces rotation friction dramatically.

### M9. Anomaly detection

**What**: model usual access patterns; alert on deviations. "Alice usually reads `@billing.dev.*` between 09:00 and 18:00 from CI runners; she just read `@billing.prod.db_pass` from a residential IP at 03:00."

**How**: lightweight per-user/per-alias time-of-day + caller fingerprint baseline. Alerts go to SIEM (M5).

**Why commercial**: insider-threat and prompt-injection late detection.

### M10. Hardware-token MFA

**What**: WebAuthn / FIDO2 hardware-key MFA. Required for sensitive operations (KEK rotation, prod-tier reads beyond a threshold).

**How**: standard WebAuthn flow integrated with the auth layer.

**Why commercial**: required for some regulated environments; nice-to-have everywhere.

### M11. Custom RBAC / policy DSL

**What**: arbitrary roles + ABAC predicates. "Any user with attribute `team=billing` can read `@billing.*` between 09:00 and 18:00 in their tz".

**How**: pluggable policy engine; we'd evaluate Cedar or OPA for the DSL.

**Why commercial**: rare requirement, but absolute deal-breaker for teams that need it.

### M12. Audited collaboration on secrets

**What**: multi-party computation flows for "no single user knows the value" (Shamir's Secret Sharing, threshold encryption). E.g., a master CA private key requires reconstruction by 3 of 5 admins.

**How**: integrate `node-shamir` or equivalent; flow surfaces in CLI + UI.

**Why commercial**: niche but high-value.

## Pricing model (sketch — TBD with go-to-market)

- **Free tier (open-core)**: everything in Phase 1–5. MIT/Apache-2.0.
- **Team tier ($X/user/mo)**: SSO, multi-step approvals, SIEM forwarding.
- **Enterprise tier (contact sales)**: HSM/KMS, anomaly detection, custom RBAC, SLA, dedicated support.

Pricing finalized once first paying customer signs.

## Engineering principles for the commercial tier

1. **Open-core is a real product, not a teaser.** Anything that meaningful security depends on must be in OSS. Commercial adds convenience, scale, compliance — not "you can't have safety unless you pay".
2. **Every commercial module sits behind a clean interface in OSS.** No `if (commercial) { ... }` branches scattered through OSS. The OSS code defines contracts; commercial fulfills them.
3. **No telemetry phone-home from OSS without explicit opt-in.** Even commercial telemetry is opt-in by default and documented.
4. **Same audit invariants.** Commercial features extend audit, never bypass it.
5. **Documentation parity.** OSS docs cover OSS features; commercial docs are private but follow the same standards.

## Out-of-scope (not even Phase 6)

- Browser extension to autofill secrets.
- Personal-credential management (password manager replacement).
- Training a model on your secrets data. Ever.
