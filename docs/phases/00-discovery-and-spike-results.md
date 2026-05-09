# Phase 0 — Spike results

Captured on the development workstation (Apple Silicon, macOS, Node 22.16, no Bun installed). Numbers are indicative; CI workstations will produce a second baseline once the workflow runs.

## CLI cold-start

| Runtime | Median (ms) | p95 (ms) |
|---|---|---|
| Node (warm cache) | 28.7 | 39.7 |
| Bun | not measured (binary not installed locally) |  |

**Verdict**: Node-only baseline well below the 100 ms target. Bun is expected to be ~5× faster cold-start; will be re-measured in CI once the matrix includes a Bun toolchain step.

## MCP stdio round-trip

- 1000 requests through a Node child process speaking line-delimited JSON-RPC.
- **Median**: 0.02 ms
- **p95**: 0.05 ms

**Verdict**: Far below the 20 ms target. MCP overhead is essentially noise on this hardware. Real-world numbers under load will be re-measured in Phase 2 with the actual `keynv-mcp` server, but the SDK + transport layer is not the constraint.

## libsodium secretbox throughput

| Payload | Encrypt ops/s | Decrypt ops/s | Target | Verdict |
|---|---:|---:|---:|---|
| 32 B   | 1,826,287 | 1,559,353 | 100,000 | OK (18×) |
| 1 KB   |   287,531 |   278,727 |  30,000 | OK (9×) |
| 4 KB   |    83,130 |    79,409 |  10,000 | OK (8×) |

**Verdict**: libsodium-wrappers throughput is comfortably above target across all sizes. Crypto will not be a bottleneck for any realistic keynv workload. We will keep `@noble/ciphers` as a documented fallback in case Bun introduces incompatibility later.

Note: had to load libsodium-wrappers via `createRequire` because its internal `import 'libsodium'` confuses tsx's bare-specifier ESM resolver. The production Node server uses CJS interop in this same way, so the workaround mirrors actual deployment.

## SQLite WAL audit-chain insert

| Mode | Rows | Elapsed | Rows/s | Target | Verdict |
|---|---:|---:|---:|---:|---|
| Single insert / tx     | 100,000 | 2.75 s | 36,309  |  5,000 | OK (7×) |
| Batched 1000 / tx      | 100,000 | 0.66 s | 152,544 | 50,000 | OK (3×) |

**Verdict**: SQLite + WAL is dramatically over-provisioned for the 15-person-team workload. Phase 1 will use single-row inserts for audit appends (one HTTP request → one audit row), with batched mode reserved for bulk operations like KEK rotation re-encrypts.

## Decisions confirmed

- **Bun for the CLI** — no concrete reason to walk away; will retest in CI matrix once Bun is added to the workflow.
- **libsodium-wrappers for crypto** — keep. `@noble/ciphers` remains a documented fallback.
- **SQLite + WAL for the server vault** — keep. Postgres is a Phase 6 commercial concern.
- **MCP stdio transport** — keep. HTTP transport is an opt-in extra for daemon-mode setups.

## Decisions deferred

- Final Bun cold-start verdict pending a CI run on Linux x64 and macOS arm64 with Bun installed. If Bun on Linux x64 exceeds 200 ms, escalate to a daemon architecture.
- libsodium ESM-resolution workaround (createRequire) is fine for spikes but Phase 1 will pin a clean import path or wrap libsodium behind `packages/core/src/crypto/` so callers don't have to repeat the workaround.

## Reproducing

```bash
pnpm install
pnpm --filter @keynv/spikes spike:all
```

(Requires the better-sqlite3 native binding; see `scripts/spikes/README.md` for the rebuild step on systems where pnpm skips postinstall scripts.)
