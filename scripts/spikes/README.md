# Phase 0 spikes

One-off measurement scripts that validate the master plan's load-bearing performance assumptions before Phase 1 starts. Each script prints a single result line plus a verdict against the documented target.

## Targets (from `docs/phases/00-discovery-and-spike.md`)

| Spike | Target | Hard fail |
|---|---|---|
| CLI cold start (Bun-compiled) | < 100 ms warm cache, < 200 ms cold | > 300 ms |
| MCP stdio round-trip | < 20 ms locally | > 50 ms |
| libsodium 32-byte secretbox | > 100K ops/s | < 50K ops/s |
| libsodium 4 KB secretbox | > 10K ops/s | < 5K ops/s |
| SQLite WAL audit-chain insert | > 5K writes/s sustained | < 2K writes/s |

A "hard fail" forces a design discussion before Phase 1 (e.g., switching from Bun → Node + daemon, or from libsodium-wrappers → @noble/ciphers).

## Running

```bash
# install spike dependencies first
pnpm install

# individual spikes
pnpm --filter @keynv/spikes spike:cli-startup
pnpm --filter @keynv/spikes spike:mcp-overhead
pnpm --filter @keynv/spikes spike:libsodium
pnpm --filter @keynv/spikes spike:sqlite

# run them all
pnpm --filter @keynv/spikes spike:all
```

Results should be captured in `docs/phases/00-discovery-and-spike-<topic>.md` per the phase doc.

## Notes

- Bun-specific measurements require Bun ≥ 1.x to be on `PATH`. Without Bun, `cli-startup.ts` falls back to measuring Node start time.
- These scripts mutate temporary files under `tmp/` (gitignored). They clean up after themselves.
- Each script aims to be reproducible: fixed seeds, no network, single-threaded.
