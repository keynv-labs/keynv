# 06 — API Spec

The keynv API surface, in two layers: a REST API for human/CLI consumption, and an MCP API for AI agents. Both are versioned (`/v1/...`) and validated with zod schemas at every boundary.

## Conventions

- Base URL: `https://<server>/v1`
- All requests are JSON unless noted. Content-Type `application/json; charset=utf-8`.
- Auth: `Authorization: Bearer <jwt>` for human/CLI calls; `Authorization: Bearer <cache-token>` for short-lived CLI cache reads.
- Errors return `{error: {code, message, request_id}}` with appropriate HTTP status. Errors **never** include secret values, partial values, or ciphertext.
- Idempotency: write endpoints accept `Idempotency-Key` header (UUID). Reuse within 24h returns the original response.
- Rate limits: defaults documented; 429 with `Retry-After`.

## REST API

### Authentication

#### `POST /v1/auth/login`

Exchange email + password for a JWT + refresh token.

Request:
```json
{ "email": "alice@team.com", "password": "..." }
```
Response 200:
```json
{
  "access_token": "<jwt 15min>",
  "refresh_token": "<opaque 7d>",
  "user": { "id": "u_...", "email": "alice@team.com", "org_role": "developer" }
}
```

#### `POST /v1/auth/cli/browser/start`

Starts a short-lived browser authorization flow for the CLI. Raw device and user
codes are returned once and only SHA-256 hashes are persisted.

Request:
```json
{ "device_name": "alice-laptop" }
```
Response 201:
```json
{
  "device_code": "<opaque>",
  "user_code": "ABCD-2345",
  "verification_uri": "https://keynv.dev/cli/authorize",
  "verification_uri_complete": "https://keynv.dev/cli/authorize?code=ABCD-2345",
  "expires_in": 600,
  "interval": 2
}
```

#### `POST /v1/auth/cli/browser/poll`

CLI polling endpoint. While the browser has not approved the flow, response is
202 `{ "status": "pending" }`. After approval, response 200 matches `/login` and
the device code is consumed.

Request:
```json
{ "device_code": "<opaque>" }
```

#### `POST /v1/auth/cli/browser/authorize`

Authenticated browser endpoint. Authorizes the pending CLI flow for the current
web session. Response 204.

Request:
```json
{ "user_code": "ABCD-2345" }
```

#### `POST /v1/auth/refresh`

Request:
```json
{ "refresh_token": "..." }
```
Response 200: same shape as `/login` (rotated refresh token).

#### `POST /v1/auth/logout`

Invalidates the refresh token. Response 204.

### Session lifecycle

| Token type | Default TTL | Env var to override |
|---|---|---|
| Access token (JWT) | 15 minutes | `KEYNV_ACCESS_TOKEN_TTL_S` |
| Refresh token | 7 days | `KEYNV_REFRESH_TOKEN_TTL_S` |
| CLI token | No expiry (optional `expires_at` on creation) | — |
| Browser auth flow | 10 minutes | — |

**Access tokens** are short-lived JWTs. When an access token expires, the next API call returns HTTP 401 with code `auth.token_expired`.

**The CLI refreshes automatically.** `ApiClient` catches the first 401, calls `POST /v1/auth/refresh` to get a new access token + refresh token, persists the new pair, and retries the original request. The rotation is transparent to the user unless the refresh token itself has also expired.

**When the refresh token expires** the CLI receives 401 and the silent refresh returns null. The failed request surfaces as an error, and the user must run `keynv` again to reconnect from the TUI. Credentials stored on disk are NOT cleared automatically on expiry — `keynv logout` clears them explicitly, or they are overwritten on next login.

**CLI tokens** (issued via Settings → CLI tokens) are long-lived Bearer tokens stored as a bcrypt-style hash in the database. They are **not** JWT access tokens and do not participate in the refresh flow. When a CLI token is revoked (via the web UI or `DELETE /v1/cli-tokens/:id`) or expires, subsequent requests return HTTP 401 with code `auth.invalid_credentials`. The user must issue a new token.

### Organizations & users

#### `POST /v1/users/invite`  (Owner/Admin)

Invite a new user to the org.
```json
{ "email": "bob@team.com", "org_role": "developer" }
```
Response 201: `{user: {...}, invite_token: "..."}`. Token TTL 7 days.

#### `POST /v1/users/accept-invite`

Body: `{invite_token, password}`. Response: same as login.

#### `GET /v1/users` (Owner/Admin)

Returns array of org users.

#### `DELETE /v1/users/:id` (Owner/Admin)

Remove a user from the org. Cascades memberships.

#### `PATCH /v1/users/:id/org-role` (Owner/Admin; Owner role transfer is Owner-only)

Body: `{org_role: "admin" | "developer" | "reader"}`.

### Projects

#### `GET /v1/projects` (any authenticated user; filtered by membership)

Lists projects the caller can see.

#### `POST /v1/projects` (Owner/Admin)

```json
{
  "name": "billing",
  "environments": [
    { "name": "dev",  "tier": "non-production" },
    { "name": "prod", "tier": "production", "require_approval": true }
  ]
}
```

Server generates a DEK, wraps it with the master KEK, persists.

#### `GET /v1/projects/:id`

Returns project metadata (no secret values, no DEK material).

Response 200:
```json
{
  "id": "p_...",
  "name": "billing",
  "created_at": "2026-05-18T12:00:00.000Z",
  "environments": [
    { "id": "env_...", "name": "dev", "tier": "non-production", "require_approval": false },
    { "id": "env_...", "name": "prod", "tier": "production", "require_approval": true }
  ]
}
```

#### `POST /v1/projects/:id/environments` (`environment.create`)

Adds an environment to an existing project. Owner/Admin can add environments; project leads
can add environments for projects where they have the lead role.

```json
{
  "name": "staging",
  "tier": "non-production",
  "require_approval": false
}
```

Response 201:
```json
{
  "id": "env_...",
  "name": "staging",
  "tier": "non-production",
  "require_approval": false
}
```

Errors:

- `project.not_found` when the project does not exist or is deleted.
- `environment.already_exists` when the environment name already exists on the project.
- `validation.failed` when name, tier, or approval fields fail validation.

#### `DELETE /v1/projects/:id` (Owner/Admin)

Soft-delete (Phase 1) — secrets and DEK marked deleted, retained in audit. Hard-delete is a Phase 4 admin operation.

#### `POST /v1/projects/:id/rotate-dek` (Owner/Admin) — _planned, not yet implemented_

Will generate a new DEK and re-encrypt all secrets in a single transaction. This
endpoint and the corresponding `keynv project rotate-dek` CLI command are not
shipped yet; tracked for a later iteration.

### Members

#### `GET /v1/projects/:id/members`

Lists memberships for a project.

#### `POST /v1/projects/:id/members` (Owner/Admin/Lead-of-this-project)

```json
{ "user_id": "u_...", "role": "developer" }
```

#### `PATCH /v1/projects/:id/members/:user_id` (Owner/Admin/Lead-of-this-project)

```json
{ "role": "lead" }
```

#### `DELETE /v1/projects/:id/members/:user_id` (Owner/Admin/Lead-of-this-project)

### Secrets

#### `POST /v1/projects/:id/secrets` (secret.create)

```json
{
  "env": "prod",
  "key": "db_password",
  "value": "...plaintext..."
}
```

The plaintext is encrypted server-side with the project's DEK. Plaintext **never persists** anywhere.

Response 201:
```json
{
  "alias": "@billing.prod.db_password",
  "version": 1,
  "created_at": "2026-..."
}
```

#### `POST /v1/projects/:id/secrets/batch` (secret.create)

Atomically creates multiple secrets. The server validates the full batch before writing any rows and persists the batch in one transaction. Maximum 50 secrets per batch.

```json
{
  "secrets": [
    { "env": "dev", "key": "db_password", "value": "...plaintext..." }
  ]
}
```

Response 201:
```json
{
  "created": [
    { "alias": "@billing.dev.db_password", "version": 1 }
  ]
}
```

Validation failure response 400:
```json
{
  "error": {
    "code": "secret.batch_invalid",
    "message": "Batch contains invalid or duplicate secrets.",
    "details": [
      { "index": 0, "code": "secret.already_exists", "env": "dev", "key": "db_password" }
    ]
  }
}
```

Errors that occur inside the batch validation write zero secrets. Item-level detail codes include `validation.failed`, `environment.not_found`, `secret.duplicate_in_batch`, and `secret.already_exists`.

#### `GET /v1/projects/:id/secrets`

Lists alias names + metadata (created_at, last_rotated_at, version) — never values.

```json
{
  "secrets": [
    { "alias": "@billing.prod.db_password", "version": 3, "rotated_at": "..." },
    { "alias": "@billing.prod.db_url",      "version": 1, "rotated_at": null }
  ]
}
```

#### `GET /v1/projects/:id/secrets/:env/:key` (secret.read)

Resolves and returns the value. Subject to RBAC and approval-tier policy.

```json
{
  "alias": "@billing.prod.db_password",
  "value": "...plaintext...",
  "version": 3,
  "ttl_s": 300
}
```

The `ttl_s` is the recommended cache lifetime. If the request was issued via a CLI cache flow, the body returns a wrapped form instead:

```json
{
  "alias": "@billing.prod.db_password",
  "ciphertext": "...",
  "nonce": "...",
  "dek_wrapped": "...",
  "version": 3,
  "ttl_s": 300
}
```

The CLI unwraps in-process. The server **never** logs the plaintext branch's value.

#### `POST /v1/projects/:id/secrets/:env/:key/rotate` (secret.rotate)

```json
{ "new_value": "...plaintext..." }
```

Creates version N+1; the previous version is **immediately marked
deleted** (Phase 1–5 behavior). A configurable `rotation_grace_s`
window during which both versions resolve in parallel is a Phase 6
commercial feature so consumers (k8s pods, CI runners) can refresh
before the old value is invalidated. Until that ships, callers must
ensure consumers re-fetch synchronously after a rotate.

Response includes `next_rotation_at` when a rotation interval is configured:

```json
{
  "alias": "@billing.prod.db_password",
  "version": 2,
  "next_rotation_at": "2026-08-17T12:00:00.000Z"
}
```

#### `PATCH /v1/projects/:id/secrets/:env/:key/rotation` (secret.rotate)

Configures a rotation interval for an existing secret without changing its
value. Accepts `interval_days` (1–365). When set the server computes
`next_rotation_at` from `now() + interval_days`.

```json
{ "interval_days": 30 }
```

Response:

```json
{
  "alias": "@billing.prod.db_password",
  "interval_days": 30,
  "next_rotation_at": "2026-06-17T12:00:00.000Z"
}
```

Errors: `secret.not_found`, `validation.failed`.

#### `GET /v1/projects/:id/secrets/rotations` (secret.read)

Returns secrets that have a rotation interval configured. Accepts optional
query parameters:

- `?due=true` — filters to secrets where `next_rotation_at <= now`.
- `?overdue=true` — alias for due.

Results include a `status` field: `"due"` when overdue, `"upcoming"` when
still within the window.

```json
{
  "secrets": [
    {
      "alias": "@billing.prod.db_password",
      "version": 3,
      "rotation_interval_days": 90,
      "rotated_at": "2026-05-01T12:00:00.000Z",
      "next_rotation_at": "2026-07-30T12:00:00.000Z",
      "status": "upcoming"
    }
  ]
}
```

#### `DELETE /v1/projects/:id/secrets/:env/:key` (secret.delete)

Soft-deletes; audit retains.

#### `POST /v1/projects/:id/secrets/:env/:key/test` (Phase 3, secret.test)

```json
{ "tester": "postgres", "host": "...", "port": 5432, "database": "...", "user": "..." }
```

Server resolves the secret, runs the configured tester, returns result. Connection details (`host`, `port`, ...) come from the request body, not the secret. The secret is the value (typically password).

```json
{ "ok": true, "latency_ms": 24 }
```

If `ok=false`, `error` is sanitized:
```json
{ "ok": false, "latency_ms": 412, "error": "authentication failed" }
```

### Audit log

#### `GET /v1/audit?project=...&since=...&until=...&actor=...&event_type=...&limit=100&cursor=...`

Returns audit entries (forward-paged).

Response:
```json
{
  "entries": [
    { "id": 12345, "ts": "...", "actor_user_id": "u_...", "actor_agent": "claude-code-1.5.0",
      "event_type": "secret.read.allowed",
      "payload": { "alias": "@billing.prod.db_password" },
      "prev_hash": "...", "hash": "..." }
  ],
  "next_cursor": "..."
}
```

Payloads are designed to never contain values; the schema enforces it.

#### `POST /v1/audit/verify`

Server-side verification of the chain over a range. Returns the first inconsistency, if any.

### Approvals (Phase 4)

#### `POST /v1/approvals`

Implicit when a developer's `secret.read` triggers approval. Response 202 with `request_id`.

#### `POST /v1/approvals/:id/grant` (Owner/Admin/Lead)
#### `POST /v1/approvals/:id/deny`  (Owner/Admin/Lead)

### Health and metrics

#### `GET /v1/health` (no auth)

Compatibility endpoint for basic API health. It checks database readiness and
returns capability flags used by the web client.

```json
{
  "ok": true,
  "version": "0.5.0",
  "db": "ok",
  "capabilities": {
    "public_registration": false,
    "api": {
      "current": "v1",
      "supported": ["v1"],
      "stability": "pre-1.0",
      "min_cli_version": "0.1.0-rc.21"
    },
    "features": {
      "batch_secret_create": true,
      "environment_management": true,
      "health_probes": true,
      "prometheus_metrics": true
    }
  }
}
```

Clients should treat missing feature flags as `false` and check them before
using recently-added endpoints when practical.

#### `GET /v1/health/live` (no auth)

Liveness probe for process supervisors and Kubernetes. It does not check
downstream dependencies; a running process returns 200.

```json
{ "ok": true, "status": "live", "version": "0.5.0" }
```

#### `GET /v1/health/ready` (no auth)

Readiness probe for load balancers and orchestrators. It checks database access
and returns 503 when the server should not receive traffic.

```json
{
  "ok": true,
  "version": "0.5.0",
  "db": "ok",
  "capabilities": {
    "public_registration": false,
    "api": {
      "current": "v1",
      "supported": ["v1"],
      "stability": "pre-1.0",
      "min_cli_version": "0.1.0-rc.21"
    },
    "features": {
      "batch_secret_create": true,
      "environment_management": true,
      "health_probes": true,
      "prometheus_metrics": true
    }
  }
}
```

#### `GET /metrics` (no auth)

Prometheus text exposition endpoint. Labels intentionally avoid user emails,
secret aliases, raw paths, or project/environment/secret names.

Included metric families:

- `keynv_http_requests_total{method,route,status_class}`
- `keynv_http_errors_total{method,route,status_class}`
- `keynv_http_request_duration_seconds_bucket|sum|count{method,route,status_class}`
- `keynv_domain_events_total{event}` for `secret_read`, `secret_write`,
  `audit_append`, `approval_grant`, `approval_denial`, and
  `rate_limit_rejection`

Route labels use normalized templates such as
`/v1/projects/:projectId/secrets/:env/:key`, never the concrete path.

## MCP API (`keynv-mcp`)

Implements the MCP 2025-06 specification over stdio. Tools:

### `keynv.use_secret`

```ts
input: { alias: string }
output: {
  reference_token: string,   // single-use, 60-second TTL
  alias: string,             // echoed for confirmation
  expires_at: string         // ISO timestamp
}
```

The `reference_token` is opaque and single-use (60-second TTL). It is redeemed with `keynv exec --resolve NAME=<token>`, which connects to the running `keynv-mcp` server over a local 0600 same-user socket; `keynv-mcp` resolves the value and returns it to the `keynv exec` subprocess, which injects it as env var `NAME` and redacts it from output. The raw value never returns to the agent.

### `keynv.list_secrets`

```ts
input: { project: string }
output: {
  secrets: Array<{ alias: string, version: number, rotated_at?: string }>
}
```

Returns alias names only. Never values.

### `keynv.test_connection`

```ts
input: { alias: string, tester: "postgres" | "mysql" | ..., target: TesterTarget }
output: {
  ok: boolean,
  latency_ms: number,
  error?: string  // sanitized
}
```

Convenience wrapper around `keynv test`. The agent never sees the value.

### `keynv.redact_text`

```ts
input: { text: string, custom_patterns?: Array<{name: string, regex: string}> }
output: {
  redacted: string,
  matches_found: number,
  pattern_summary: Array<{name: string, count: number}>
}
```

Lets agents self-redact text (e.g., before posting a Slack message they're drafting). Useful for hooks where the agent wants to verify output safety before action.

### `keynv.who_am_i`

```ts
input: {}
output: {
  user_id: string,
  email: string,
  org_role: string,
  memberships: Array<{ project: string, role: string }>
}
```

Lets the agent know what permissions it has (so it can fail gracefully and explain to the user, e.g., "I don't have prod access; ask a lead to approve").

## Validation

Every request and response goes through a zod schema declared in `packages/core/src/api/schemas.ts`. The same schemas are reused on the client (CLI) and server, ensuring drift-free typing.

## Versioning

`/v1` is the only stable namespace. `/v2` will require a new specification doc;
the server may serve both for an overlap period. The detailed CLI/server skew,
capability-discovery, and deprecation policy is maintained in
[`api-compatibility.md`](./api-compatibility.md).

Before `v1.0.0`, release-candidate APIs may change, but breaking changes must be
called out in release notes. After `v1.0.0`, additive `/v1` changes are allowed;
breaking changes require either a new namespace or a `/v1` compatibility shim for
at least one minor release. Deprecated `/v1` behavior receives at least 90 days
notice before removal.

MCP tool names are versioned by name (`keynv.use_secret_v2`) when breaking changes are needed; we never silently change semantics.

## Error catalog

| Code | HTTP | Message family |
|---|---|---|
| `auth.invalid_credentials` | 401 | "Invalid email or password." |
| `auth.token_expired` | 401 | "Access token expired." |
| `auth.token_revoked` | 401 | "Token has been revoked." |
| `rbac.denied` | 403 | "Permission denied." (carries `required_role` + `your_role` for context) |
| `rbac.approval_required` | 202 | "Production access requires approval." (returns `request_id`) |
| `secret.batch_invalid` | 400 | "Batch contains invalid or duplicate secrets." |
| `secret.not_found` | 404 | "No secret matching alias." |
| `secret.invalid_alias` | 400 | "Invalid alias format." |
| `tester.unsupported` | 400 | "Unsupported tester type." |
| `tester.failed` | 200 (with `ok=false`) | (sanitized) |
| `audit.chain_broken` | 500 | "Audit chain inconsistency detected at row N." |
| `rate_limited` | 429 | "Too many requests." |
| `internal_error` | 500 | "Internal error." (logs request_id; no internal detail surfaced) |
