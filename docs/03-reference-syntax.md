# 03 — Reference Syntax

The alias used to refer to a secret. This is what AI agents see; the value is never substituted into the agent's tool input.

## Format

```
@<project>.<environment>.<key>
```

Examples:

```
@billing.prod.db_password
@auth-service.staging.jwt_signing_key
@search.dev.elastic_admin
@legacy.test.aws_access_key_id
```

## Lexical rules

| Component | Allowed characters | Length | Examples |
|---|---|---|---|
| `project` | `[a-z0-9][a-z0-9-]*` (kebab-case, lowercase) | 1–48 chars | `billing`, `auth-service` |
| `environment` | `[a-z0-9][a-z0-9-]*` | 1–24 chars | `prod`, `dev`, `pr-1234` |
| `key` | `[a-z0-9][a-z0-9_-]*` (kebab or snake) | 1–64 chars | `db_password`, `jwt-signing-key` |

Total alias length is capped at 1+48+1+24+1+64 = 139 characters. The leading `@` is part of the literal.

Strict lowercase: `@Billing.Prod.X` is not valid. We don't normalize because case-insensitive matching invites typo-driven access bugs ("did I mean prod or Prod?").

## Detection regex

```ts
const ALIAS_RE =
  /(?<![\w.@/])@[a-z0-9][a-z0-9-]{0,47}\.[a-z0-9][a-z0-9-]{0,23}\.[a-z0-9][a-z0-9_-]{0,63}(?![\w.])/g;
```

The negative lookbehind `(?<![\w.@/])` prevents matching inside email addresses (`x@billing.example.com`), file paths, or already-qualified URLs. The negative lookahead `(?![\w.])` stops at word boundaries.

Tests for the parser must include all of:

- Bare token in shell argv: `mysql -p@billing.prod.db_password` ✓
- Inside double quotes: `"connect to @billing.prod.db_url"` ✓
- Inside single quotes: `'@billing.prod.db_url'` ✓
- Adjacent punctuation: `(@billing.prod.db_password),` ✓
- Inside email: `support@billing.example.com` ✗ (no match)
- Inside URL: `https://billing.example.com/foo` ✗
- Truncated alias `@billing.prod` (only two parts): ✗ (must have all three)
- Malformed alias `@Billing.Prod.X` (case): ✗
- Multiple aliases on one line: each found individually ✓

## Resolution semantics

When the parser finds an alias in command argv or a tool input, the resolver:

1. Looks up the alias in the local cache (SQLite, age-sealed). If present and TTL not expired, use cached ciphertext.
2. If cache miss or expired, calls server `GET /v1/projects/:project/secrets/:env/:key`. Authorization is enforced server-side per RBAC.
3. Decrypts the secret using the project's DEK (which itself was unwrapped with the master KEK from the OS keychain).
4. The plaintext value is held only in the privileged subprocess's argv/env/stdin. It is **never** logged, **never** returned through MCP tool responses, and **never** written to disk.

## Where aliases are valid

Aliases are detected and resolved in:

| Surface | Behavior |
|---|---|
| `keynv exec -- <cmd args...>` argv | Substituted at fork-exec time. |
| `keynv exec --stdin <cmd>` and stdin | Substituted line-buffered into subprocess stdin. |
| `keynv-mcp` `use_secret(alias)` parameter | Returns reference token, not value. |
| `.keynv.toml` per-project config (alias→destination mapping) | Used by `keynv exec --env-from`. |
| `keynv test <alias>` argument | Resolved internally; never printed. |

Aliases are **NOT** auto-resolved in:

- Arbitrary file contents read by the agent (`Read` tool). The redactor catches those if the agent reads a file containing aliases — but no resolution happens.
- Server logs, CLI logs, or audit entries. We only log the alias name, never the value.
- Stack traces and error messages.

## `.keynv.toml` schema (per-project config)

A repo opting into keynv places a `.keynv.toml` at its root. Example:

```toml
# .keynv.toml — checked into version control
project = "billing"

[environments.dev]
description = "Local development"

[environments.prod]
description = "Production"
require_approval = true   # Phase 4+

[env]
# Map of env-var name → alias. Used by `keynv exec --env-from .keynv.toml`
# so common dev workflows just work: `keynv exec -- bun dev`
DATABASE_URL  = "@billing.{env}.db_url"
JWT_SECRET    = "@billing.{env}.jwt_signing_key"
STRIPE_KEY    = "@billing.{env}.stripe_secret_key"

[env_from_args.cli]
# Optional: when running `keynv exec --env-from .keynv.toml --env=dev -- bun dev`,
# expand {env} to "dev". Defaults to KEYNV_ENV env var or `dev`.
```

The `{env}` template variable lets the same `.keynv.toml` cover multiple environments.

## Error messages (sanitized)

When resolution fails, we surface a non-leaky error:

| Failure | Error message |
|---|---|
| Alias not parseable | `keynv: invalid alias '<input>'. Expected @project.env.key.` |
| Project not found | `keynv: unknown project 'billing'. Run 'keynv project list' to see available projects.` |
| Environment not found | `keynv: project 'billing' has no environment 'staging'. Run 'keynv project describe billing'.` |
| Key not found | `keynv: no secret 'db_password' in billing/prod. Available keys: db_url, jwt_signing_key.` |
| Permission denied | `keynv: permission denied for @billing.prod.db_password (your role: developer; required: read on prod-tier).` |
| Server unreachable, cache stale | `keynv: cannot resolve @billing.prod.db_password — server unreachable and cache expired (age: 12m).` |

Note: we deliberately list sibling key names on "key not found" (since names are not secret) but never list values, never quote partial values, never include cipher debugging in user-facing errors.

## Open issues

- **Templating** — should `.keynv.toml` support more than `{env}`? Initially no; tighten before generalizing.
- **Multi-line values** — long secrets (e.g., RSA private keys) get awkward in some surfaces; we may add a `keynv exec --stdin-from <alias>` mode in Phase 1 to pipe a multi-line value through stdin without ever appearing in argv.
- **Versioned references** — sometimes you want "the v3 of this secret" for compatibility. Phase 1 ships latest-only; versioning syntax (`@billing.prod.db_password@v3`) reserved.
