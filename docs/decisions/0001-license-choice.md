# 0001 — License choice (MIT)

**Status**: Accepted · finalized in Phase 5.

## Context

The repository needed a license from day one so contributions could be accepted.
This decision was provisionally adopted at the start of Phase 0 ("MIT for Phases 0–4,
final review in Phase 5") and is now finalized as part of the Phase 5 hardening +
public-release effort.

## Decision

The open-source core ships under **MIT**. The `LICENSE` file at the repo root
carries the standard MIT text with copyright "(c) 2025-2026 keynv-labs and
contributors".

## Why MIT (re-confirmed in Phase 5)

- Maximum compatibility with downstream consumers — every JavaScript/TypeScript
  package keynv depends on is MIT, ISC, or Apache-2.0; no GPL contagion in the
  tree.
- Minimal contributor friction (no patent-grant clause to debate; standard text).
- Aligns with the rest of the ecosystem keynv lives in (Hono, Drizzle, Zod,
  better-sqlite3, …).
- Switching from MIT → Apache-2.0 (or dual-licensing) in the future is
  commonly-trod; the reverse is harder. Keeping the option open.

## Phase 6 commercial modules

When `packages/ee/*` (SSO, HSM, SIEM, multi-step approvals) ships in Phase 6,
those modules will live under a **separate, non-MIT commercial license** in their
own subdirectory. The boundary is enforced two ways:

1. Each `ee/*` package has its own `LICENSE` file at the package root that the
   open-core MIT does not apply to.
2. CI (semgrep custom rule, Phase 5 audit) blocks imports from `ee/*` into the
   open-core packages.

This is the same open-core arrangement Infisical, Posthog, and Sentry use.

## Consequences

- All Phase 0–5 contributions land under MIT, including the contributions made
  before this finalization (provisional MIT was honored from commit 1).
- The `package.json` `"license"` field stays `"MIT"` across all open-core
  packages.
- README, CONTRIBUTING, and landing-page copy drop the "provisional / not yet
  OSI-licensed" hedges that referenced this decision.
- A relicense to Apache-2.0 (or a dual MIT/Apache-2.0 setup) remains possible
  later but would require explicit contributor consent (CLA or per-contributor
  sign-off).

## Revisit when

- A customer or partner surfaces a material patent-grant requirement.
- A dual MIT/Apache-2.0 setup becomes attractive (common in modern OSS).
- A copyleft license becomes strategically valuable (unlikely for keynv's open
  core; possible for `ee/*` modules at the commercial boundary).
