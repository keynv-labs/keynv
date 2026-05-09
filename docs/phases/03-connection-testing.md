# Phase 3 — Connection Testing

**Duration estimate**: 2 weeks (full-time, solo).

**Goal**: Allow team leads and developers to verify "does this credential actually work?" without the credential's value ever appearing in their terminal, an LLM context, or a log line. Ship pluggable testers for the most common protocols, a CLI command, and server-side scheduled health checks.

**Status**: blocked on Phase 2.

---

## Why this phase matters

When a secret rotates, the most common operational question is: "did the rotation succeed end-to-end, or did I just break production?". Today this gets answered by manually running `psql` / `mysql` / `redis-cli` / `ssh` / `curl`, copy-pasting the new value — exactly the leak vector keynv exists to prevent.

`keynv test @alias` runs the test inside the privileged subprocess layer (Phase 2). The CLI/UI shows OK or FAIL with latency; the value is never printed.

## Scope

Pluggable tester architecture in `packages/testers/`. Phase 3 ships nine concrete testers; the architecture admits more without changes to the runner.

Out of scope:
- Cron-style multi-stage health checks (Phase 4 web UI).
- Anomaly-detection on test failures (Phase 6).

## Deliverables

### 1. Tester interface (`packages/testers/src/types.ts`)

```ts
export type TesterType =
  | "postgres" | "mysql" | "mongodb" | "redis"
  | "ssh"
  | "http"
  | "aws-iam" | "gcp-sa" | "azure-sp";

export interface TesterTarget {
  // tester-specific shape; e.g. postgres: { host, port, database, user }
  // Phase 3 ships zod schemas per tester.
}

export interface ResolvedSecret {
  alias: string;
  // The plaintext value. Lives only in the privileged subprocess.
  value: string;
  // Optional secondary fields (e.g., username for SSH-keypair).
  fields?: Record<string, string>;
}

export interface TestResult {
  ok: boolean;
  latency_ms: number;
  error?: string; // sanitized; must never contain `secret.value`
}

export interface Tester<T extends TesterTarget = TesterTarget> {
  type: TesterType;
  schema: ZodSchema<T>;
  test(secret: ResolvedSecret, target: T): Promise<TestResult>;
}
```

Each tester is a small module that implements `test()` with a hard timeout (default 5 s, configurable). Errors are sanitized through a tester-specific filter that removes connection strings, raw driver errors, and any value-shaped substring.

### 2. Built-in testers

#### Postgres (`packages/testers/src/postgres.ts`)
Uses `pg`. Target: `{host, port, database, user, ssl?}`. Query: `SELECT 1`. Sanitize `pg`-thrown errors to remove the URL.

#### MySQL (`packages/testers/src/mysql.ts`)
Uses `mysql2`. Target: same shape as postgres. Query: `SELECT 1`.

#### MongoDB (`packages/testers/src/mongodb.ts`)
Uses `mongodb`. Target: `{host, port, database, user, authSource?, srv?}`. Connects, runs `db.runCommand({ping: 1})`.

#### Redis (`packages/testers/src/redis.ts`)
Uses `ioredis`. Target: `{host, port, db?}`. `PING`.

#### SSH (`packages/testers/src/ssh.ts`)
Uses `ssh2`. Two modes:
- Password auth: `secret.value` is the password.
- Keypair auth: `secret.value` is the private key, `secret.fields.username` is the user.
Action: `exec("true")` and check exit code 0.

#### HTTP (`packages/testers/src/http.ts`)
Several auth modes:
- `basic` — `secret.value` is the password, target has `username`.
- `bearer` — `secret.value` is the token.
- `header` — `target.headerName` + `secret.value` becomes a header.
- `oauth2-cc` — client credentials grant: `secret.value` is the client secret, target has `client_id`, `token_url`, `scope?`.
Sends `GET target.url` (or `POST` for OAuth2). Configurable expected status range (default 2xx).

#### AWS IAM (`packages/testers/src/aws-iam.ts`)
Uses `@aws-sdk/client-sts`. Two modes:
- Long-lived access keys: `secret.value` is `secret_access_key`, `secret.fields.access_key_id` is the AKID.
- AssumeRole sessions: as above, plus `target.role_arn`.
Calls `sts:GetCallerIdentity`. Returns the caller-identity hash (not the ARN — too leaky) as part of `ok=true`.

#### GCP Service Account (`packages/testers/src/gcp-sa.ts`)
`secret.value` is the service-account JSON key. Calls `tokeninfo` endpoint with a derived access token. Returns `ok=true` if the token validates; sanitizes the email/sub.

#### Azure Service Principal (`packages/testers/src/azure-sp.ts`)
`secret.value` is the SP secret; target has `tenant_id`, `client_id`. Calls `oauth2/v2.0/token` to acquire a token. Returns `ok=true` if a token is issued.

### 3. Runner & resolver glue (`packages/testers/src/run.ts`)

```ts
async function runTest(
  alias: string,
  testerType: TesterType,
  target: TesterTarget,
): Promise<TestResult>;
```

Steps:
1. RBAC check (`secret.test`).
2. Resolve the alias (server-side or CLI-side via cache + privileged subprocess).
3. Validate `target` against the tester's zod schema.
4. Invoke `tester.test(secret, target)` with a hard timeout.
5. Sanitize the result (additional pass on top of tester's own sanitization).
6. Append audit row (`secret.test.invoked` with `ok` and `latency_ms`; never the value).

### 4. CLI

```
keynv test @alias --as <tester> [--target <key=value> ...]
keynv test @alias --as postgres --target host=localhost --target port=5432 --target database=app --target user=admin
keynv test @alias --target-from .keynv.toml#testers.db_pass    # named tester block in toml
```

Output:
```
@billing.prod.db_pass — postgres @ db.example.com:5432/app
  status: OK   latency: 24 ms
```

JSON output:
```json
{ "alias": "@billing.prod.db_pass", "tester": "postgres",
  "ok": true, "latency_ms": 24 }
```

Failure:
```
@billing.prod.db_pass — postgres @ db.example.com:5432/app
  status: FAIL  latency: 412 ms
  error: authentication failed
```

### 5. `.keynv.toml` `[testers]` block

```toml
[testers.db_pass]
type = "postgres"
target.host = "db.example.com"
target.port = 5432
target.database = "billing"
target.user = "billing_app"

[testers.api_token]
type = "http"
target.url = "https://api.example.com/v1/me"
target.auth = "bearer"
expected.status_min = 200
expected.status_max = 299
```

Aliases referenced by the testers do not appear in this block; the user invokes via `keynv test @alias --target-from .keynv.toml#testers.db_pass`.

### 6. Server-side scheduled health checks

`apps/server/src/scheduler/health.ts` runs in-process scheduler:

- For each `(secret_alias, tester_target)` registered in the project config, run the test on a schedule (default hourly, configurable).
- Persist result in `connection_tests` table.
- Surface in `keynv status`:
  ```
  Project: billing
   ┌─────────────────────────────────────┬─────┬──────────┬──────────────┐
   │ Alias                               │ OK  │ Latency  │ Last checked │
   ├─────────────────────────────────────┼─────┼──────────┼──────────────┤
   │ @billing.prod.db_pass    (postgres) │ ✓   │ 24 ms    │ 2 min ago    │
   │ @billing.prod.api_token  (http)     │ ✗   │ 412 ms   │ 1 min ago    │
   │   error: 401                        │     │          │              │
   └─────────────────────────────────────┴─────┴──────────┴──────────────┘
  ```

### 7. MCP integration

`keynv.test_connection(alias, tester, target)` MCP tool calls into the same runner. Result is identical shape to CLI output. Agent can ask "is this credential valid?" without ever seeing the value.

## Acceptance criteria

```bash
# postgres
keynv secret create @demo.dev.db_pass --value "postgres-password"
keynv test @demo.dev.db_pass --as postgres \
  --target host=localhost --target port=5432 --target database=demo --target user=demo
# OK 24ms

# wrong value
keynv secret rotate @demo.dev.db_pass --value "wrong"
keynv test @demo.dev.db_pass --as postgres \
  --target host=localhost --target port=5432 --target database=demo --target user=demo
# FAIL 412ms — authentication failed

# audit log
keynv audit list --event secret.test.invoked
# rows: ts, actor, alias, tester, ok, latency_ms — no value, ever

# scheduled
keynv status
# shows the configured testers with last result

# MCP
# Claude session: "Test the database credential"
# Agent calls keynv.test_connection — gets {ok: false, latency_ms: 412, error: "authentication failed"}
# (agent never sees the value, even on FAIL)
```

And:
- All nine testers have an integration test that runs against a docker-compose target stack.
- Sanitization regression tests confirm no tester error message ever contains the secret value (property test: feed in random secrets, assert error does not contain them).
- Latency overhead from the runner (resolve + sanitize + audit) is < 5 ms on top of the tester's own latency.

## Risks specific to Phase 3

| Risk | Mitigation |
|---|---|
| Tester error messages contain secret values | Each tester has a sanitizer; the runner re-runs the redactor on the message; property tests stress this. |
| Network/DNS conditions cause flaky test results | Configurable timeout, configurable retry count; default 5 s + 1 retry. |
| Scheduled health checks DDoS targets | Per-target rate limits; default 1 check per 60 s minimum. |
| Tester dependency bloat in CLI binary | Testers live in `packages/testers/`; server links them all. CLI ships only `postgres`, `redis`, `http`, `ssh` by default; rare testers loaded on demand or via plugins. |
| Custom-target shapes drift from server validation | Single zod schema per tester, exported from `packages/testers`, used by server, CLI, MCP. |

## Hand-off to Phase 4

Phase 4 (web UI) starts with:
- Server-side test results in DB to display.
- MCP `test_connection` tool for agent flows.
- Tester schemas to render input forms in the dashboard.
