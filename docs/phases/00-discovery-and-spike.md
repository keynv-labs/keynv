# Phase 0 — Discovery & Spike

**Duration estimate**: 1 week (full-time, solo).

**Goal**: Validate the load-bearing technical assumptions of the master plan before committing to several months of build. Produce a working monorepo skeleton, a reference-syntax parser, and benchmarks for Bun cold-start, MCP overhead, and crypto throughput.

**Status**: in progress.

---

## Why this phase exists

The master plan contains decisions that are easy to write down and hard to walk back. Phase 0 stress-tests them with measurements before Phase 1 starts:

- "Bun gives us a single binary with ~50 ms cold start" — measure on the target platforms.
- "MCP stdio overhead is acceptable for an interactive CLI feel" — measure the round-trip.
- "libsodium throughput is not a bottleneck" — measure encrypt/decrypt rate.
- "The `@project.env.key` regex correctly handles real shell argv" — fuzz-test it.
- "SQLite + Litestream is enough for our scale" — benchmark write throughput.

If any of these are wrong, we'd rather find out now.

## Deliverables

### 1. Monorepo skeleton

Already in place from initial repo setup (`pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `biome.json`, `.gitignore`, `README.md`, `CLAUDE.md`).

To finish in Phase 0:
- Initialize each workspace package with its own `package.json` and `tsconfig.json` (extending the base).
- Add a minimal CI pipeline (`.github/workflows/ci.yml`): lint, typecheck, test on Node 20 + Bun 1.x, ubuntu-latest + macos-latest.
- Add `pre-commit` config (gitleaks, biome).
- Add `CONTRIBUTING.md` (Phase 5 finalizes).

### 2. Spike: Bun cold-start

Build a no-op `keynv --version` and measure cold start:
- macOS arm64
- Linux x64 (ubuntu-22.04 in CI)
- Linux arm64

Target: < 100 ms total (parse args, print version, exit) on a warm filesystem cache. < 200 ms acceptable on cold cache.

If we miss target by > 50%, evaluate fallback to a Node + daemon architecture (`keynv` shim talks to a long-running daemon over a unix socket).

Output: `docs/phases/00-discovery-and-spike-bun-startup.md` with measurements + decision.

### 3. Spike: reference-syntax parser

Implement `parseAlias` and `findAliases` in `packages/core/src/reference/parser.ts`. Add tests covering:

- All examples in [03-reference-syntax.md](../03-reference-syntax.md).
- Property tests with `fast-check` for: idempotence, no value-injection (parser cannot accidentally produce non-alias output that contains `@`).
- Performance: 10K aliases per second in a 10K-line text scan.

### 4. Spike: MCP server stdio overhead

Implement a stub `keynv-mcp` that handles a no-op `keynv.who_am_i` (returning a hard-coded user). Measure round-trip latency from a test harness simulating a Claude Code MCP client.

Target: < 20 ms round-trip locally on macOS arm64 / Linux x64.

If miss, evaluate batching or HTTP-transport for high-frequency tool calls.

### 5. Spike: libsodium throughput

Benchmark `crypto_secretbox` encrypt + decrypt round-trips for:
- 32-byte values (typical password)
- 1 KB values (typical token)
- 4 KB values (RSA private key)

Target: > 100K ops/s for 32-byte; > 10K ops/s for 4 KB. (Performance not the constraint here, but record numbers for future regression.)

If `libsodium-wrappers` (WASM-backed) is too slow, evaluate `@noble/ciphers` (pure-JS) or native bindings (`sodium-native`).

### 6. Spike: SQLite write throughput

Insert 1M audit rows into a WAL-mode SQLite DB with `prev_hash` chained. Measure rows/sec and tail-latency.

Target: > 5K writes/s sustained on a typical VM. Audit-write overhead per request: < 1 ms.

If miss, profile + tune (`PRAGMA synchronous=NORMAL`, batched commits, async append).

### 7. Threat-model finalization

The threat-model doc ([02-threat-model.md](../02-threat-model.md)) is a draft. Phase 0 closes:
- Walk through OWASP LLM Top 10 with a peer (Phase 5 if not earlier).
- Confirm each enumerated threat has a concrete mitigation in Phase 1–3 deliverables (or is explicitly out-of-scope).
- Write `tests/security/` skeleton: one stub test per threat row from `02-threat-model.md`.

### 8. Reference-syntax parser → published as `@keynv/core`

The parser is the most-exercised piece of code in keynv. Ship it as a real package early so:
- Other packages depend on it (rather than re-implementing).
- The first user-visible `pnpm test` runs against real code.

## Acceptance criteria

Phase 0 is "done" when:

- [ ] `pnpm install && pnpm build && pnpm test && pnpm typecheck` is green on macOS + Linux.
- [ ] CI is green on every push (`lint`, `typecheck`, `test`).
- [ ] `keynv --version` cold-start measurements are recorded in `docs/phases/00-discovery-and-spike-bun-startup.md` with a go/no-go decision on Bun.
- [ ] MCP, libsodium, and SQLite spike numbers are recorded (one short doc per spike).
- [ ] `parseAlias` + `findAliases` are implemented with > 95% line coverage and the property tests pass.
- [ ] `tests/security/` has at least 5 failing tests with stub implementations (intentionally failing — they describe what Phase 2 must implement).
- [ ] `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` placeholders exist.
- [ ] No remaining "TBD" in the locked-decisions section of the master plan.

## Risks unique to Phase 0

| Risk | Mitigation |
|---|---|
| Bun cold-start exceeds target on Linux | Fall back to Node + daemon. Decision documented before Phase 1. |
| `libsodium-wrappers` doesn't load in Bun | Switch to `@noble/ciphers` (pure-JS) or `sodium-native` (Node native). |
| MCP SDK doesn't fit our reference-token semantics | Implement a thin custom MCP layer; SDK is convenience, not a hard requirement. |
| Litestream installation friction on developer machines | Document Docker-Compose-only path for Phase 1 dev; native install in Phase 5. |
| Scope creep into Phase 1 work | Strict timebox: 1 week. If a spike says "this needs more time", file it as a Phase 1 task and move on. |

## Out-of-scope for Phase 0

- Any user-facing feature (no `secret create`, no `keynv exec`, no auth).
- The web UI (Phase 4).
- Connection testing (Phase 3).
- Per-agent installers (Phase 2).
- Production deployment automation (Phase 5).

## Hand-off to Phase 1

When Phase 0 finishes, Phase 1 starts with:
- A green CI.
- A working `parseAlias` parser.
- A documented Bun cold-start budget.
- A stub MCP transport that proves the SDK fits our needs.
- An empty `apps/server/` ready for the Hono setup.
- An empty `apps/cli/` ready for the clipanion + Bun build.
