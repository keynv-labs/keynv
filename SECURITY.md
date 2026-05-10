# Security policy

keynv is a secrets-management product. Vulnerability reports are taken seriously and processed in private until a fix is shipped.

## Reporting a vulnerability

**Do not file a public issue.** Two private channels work today; pick whichever
fits:

1. **GitHub Private Vulnerability Reporting** (recommended) — open a private
   advisory at <https://github.com/keynv-labs/keynv/security/advisories/new>.
   GitHub-native, end-to-end private until coordinated disclosure.
2. **Email** the maintainer at `meinrufretterinfo@gmail.com` (we run keynv
   solo until the project graduates a real `security@` mailbox under the
   `keynv.dev` domain — that's a Phase 6 deliverable).

Include:

- A description of the issue and its impact.
- Steps to reproduce, or a proof-of-concept.
- The keynv version (`keynv --version` and `keynv-server --version`).
- The affected component(s).

We aim to acknowledge reports within **3 business days** and provide a
remediation timeline within **7 business days**. Solo-maintainer turnaround
during real-life events may stretch this; the GitHub advisory channel keeps
correspondence durable.

## Scope

In scope:
- The keynv server (`apps/server`).
- The keynv CLI and its privileged-subprocess wrapper (`apps/cli`).
- The keynv MCP server (`apps/mcp`).
- The web dashboard (`apps/web`, when shipped).
- All packages under `packages/`, especially `core/crypto/`, `redactor/`, `rbac/`.

Out of scope:
- Vulnerabilities in upstream dependencies that we have not yet patched but for which a fix exists upstream — please report to the upstream maintainer.
- Social-engineering or phishing attacks against keynv staff.
- Issues requiring physical access to the developer machine or root on the server host.
- Self-host operators running keynv with `--insecure` flags or non-default unsafe configuration.
- Vulnerabilities in the LLM provider's infrastructure (Anthropic, OpenAI, etc.) — keynv assumes those are untrusted, that's the design.

## Disclosure timeline

We follow [coordinated disclosure](https://www.first.org/global/sigs/vulnerability-coordination/multiparty/csd) practices:

1. Report received and acknowledged.
2. Severity triaged. CVSS 4.0 used for scoring.
3. Fix developed and tested in private.
4. Coordinated release: the fix lands; an advisory is published on the same day.
5. Reporter is credited (with consent) in the advisory.

For critical issues we may pre-notify confidential operators (large self-hosted deployments) up to 72 hours before public disclosure.

## Hall of fame

Reporters of valid issues are listed (with consent) on the docs site security page. We do not currently run a paid bug bounty; that may change as the project matures.

## PGP

No PGP key today. The recommended channel (GitHub Private Vulnerability
Reporting) is end-to-end private without one. A keynv-specific key will be
published once `security@keynv.dev` is provisioned — that's part of the
Phase 6 cloud / domain rollout.
