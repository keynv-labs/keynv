---
title: License
description: keynv's open-source core is MIT. Commercial modules are tracked separately.
sidebar:
  order: 4
---

## Open-source core: MIT

Everything in this repository — apps/cli, apps/server, apps/mcp, apps/web, apps/docs, packages/* — is licensed under the [MIT License](https://github.com/keynv-labs/keynv/blob/main/LICENSE).

The choice was made provisionally for Phase 0 ([ADR 0001](https://github.com/keynv-labs/keynv/blob/main/docs/decisions/0001-license-choice.md)). A Phase 5 review confirmed MIT for the open-source core; a possible dual MIT/Apache-2.0 future is on the table for explicit patent-grant clarity but isn't currently planned.

## Commercial modules

Phase 6 introduces optional commercial modules for enterprise scenarios:

- Postgres adapter for HA / multi-region
- SSO / SAML / OIDC adapters
- HSM / KMS integrations
- Multi-step approval workflows (M-of-N)
- SIEM forwarding (Splunk, Datadog, OpenTelemetry)
- Compliance report generators (SOC 2, ISO 27001)
- Multi-region replication

These live in a separate `enterprise/` repository under a commercial license. The open-source core never depends on enterprise code; enterprise modules implement well-typed interfaces in the open-source core.

The split is permanent: the open-core boundary is **the security primitives and the threat-model coverage**. Anything load-bearing for the threat model must be in OSS. Commercial features add convenience, scale, and compliance — never "you can't have safety unless you pay".

## Trademark

"keynv" is a trademark. Usage in documentation and articles is encouraged; usage as a product name or domain that could imply official endorsement requires permission. The full trademark policy will be published with the first signed release.
