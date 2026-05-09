# 0001 — License choice (MIT for Phase 0)

**Status**: Accepted (provisional). Final review in Phase 5.

## Context

The repository needs a license from day one so contributions can be accepted. The master plan defers final license selection to Phase 5 ("MIT or Apache-2.0"), but Phase 0 cannot ship without something concrete.

## Decision

Adopt **MIT** for the open-source core, effective from the initial commit.

## Why MIT (provisionally)

- Maximum compatibility with downstream consumers.
- Minimal contributor friction (no patent-grant clause to debate; standard text).
- Aligns with the rest of the JavaScript / TypeScript ecosystem keynv lives in.
- Switching from MIT → Apache-2.0 in the future is a commonly-trod path; the reverse is harder.

## Why not Apache-2.0 yet

- Apache-2.0's explicit patent grant is valuable for enterprise adoption but is not a Phase 0 requirement.
- A Phase 5 review with legal input will confirm whether the patent grant is needed for the commercial-tier strategy.

## Consequences

- All Phase 0–4 contributions land under MIT.
- Phase 5 may propose a relicense; if so, it will be done with explicit contributor consent (a CLA or per-contributor sign-off).
- The `LICENSE` file at the repository root carries the MIT text.
- `package.json` files declare `"license": "MIT"`.

## Revisit when

- Phase 5 hardening review.
- A material patent-grant requirement surfaces from a customer or partner.
- A relicense to dual MIT/Apache-2.0 becomes attractive (common in modern open-source projects).
