# tests/security

Regression suite that mirrors `docs/02-threat-model.md`. Each file covers one row of the model. Tests start as `it.todo(...)` placeholders that describe behavior the relevant phase must guarantee; they flip to real assertions as those phases land.

## Discipline

- A new threat row in `docs/02-threat-model.md` requires a corresponding test row here. CI does not enforce this; reviewers do.
- A test must NOT use real-looking secret values. Use clearly-fake placeholders (`example-fake-token-do-not-use`).
- A test must NOT silently bypass the redactor or RBAC engine to "make the test pass". If a test needs special data shapes, surface them through the same APIs production callers use.
- When a `todo` test is implemented, also delete the surrounding "Phase X will implement" comment — it shouldn't ship in production tests.

## Status legend

| Marker | Meaning |
|---|---|
| `it.todo(...)` | Behavior described, implementation deferred to a named phase. |
| `it.skip(...)` | Temporarily disabled; must include a `skip:` comment with a tracking issue. |
| `it(...)` | Active assertion; failing here breaks CI. |
