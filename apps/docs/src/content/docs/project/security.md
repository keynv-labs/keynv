---
title: Security policy
description: How to report a vulnerability, what's in scope, and the disclosure timeline.
sidebar:
  order: 3
---

The full policy lives at [SECURITY.md](https://github.com/keynv-labs/keynv/blob/main/SECURITY.md).

## Reporting

**Do not file a public issue.** Email `security@keynv.dev` with:

- A description of the issue and its impact.
- Steps to reproduce, or a proof-of-concept.
- The keynv version (`keynv --version`, `keynv-server --version`).
- The affected component(s).

We aim to acknowledge within **3 business days** and provide a remediation timeline within **7 business days**.

## In scope

- The keynv server (`apps/server`).
- The keynv CLI and its privileged-subprocess wrapper (`apps/cli`).
- The keynv MCP server (`apps/mcp`).
- The web dashboard (`apps/web`).
- All packages under `packages/`, especially `core/crypto`, `redactor`, `rbac`.
- Per-agent integration installers when they affect agent isolation.

## Out of scope

- Vulnerabilities in upstream dependencies that we have not yet patched but for which a fix exists upstream — please report to the upstream maintainer.
- Social-engineering / phishing against keynv staff.
- Issues requiring physical access to a developer's machine or root on the server host.
- Self-host operators running keynv with `--insecure` flags or non-default unsafe configuration.
- Vulnerabilities in the LLM provider's infrastructure (Anthropic, OpenAI, etc.) — keynv assumes those are untrusted by design.

## Disclosure timeline

Coordinated disclosure:

1. Report received and acknowledged.
2. Severity triaged (CVSS 4.0).
3. Fix developed and tested in private.
4. Coordinated release: fix lands; advisory published the same day.
5. Reporter credited (with consent) in the advisory.

For critical issues we may pre-notify confidential operators (large self-hosted deployments) up to 72 hours before public disclosure.

## Audit findings

The repository tracks audit findings publicly in [AUDIT-FINDINGS.md](https://github.com/keynv-labs/keynv/blob/main/AUDIT-FINDINGS.md). Each finding lists severity, status, closing commit, and rationale for any deferral.
