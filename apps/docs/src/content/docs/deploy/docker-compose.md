---
title: Docker Compose
description: A single-VM stack — keynv-server + Litestream sidecar replicating the SQLite WAL to S3/B2 in real time.
sidebar:
  order: 1
---

## Files

- `deploy/docker-compose.yml` — the stack
- `deploy/.env.example` — the env template
- `deploy/litestream.yml` — Litestream's config (mounted into the sidecar)
- `deploy/caddy.example.Caddyfile` — TLS proxy template

## Bring-up

```bash
git clone https://github.com/keynv-labs/keynv.git
cd keynv

cp deploy/.env.example deploy/.env
$EDITOR deploy/.env
# Required: KEYNV_JWT_SECRET = `openssl rand -base64 32`.
# Optional: Litestream S3 creds. Comment the litestream service out
# in docker-compose.yml if you don't want backup yet.

# Build the server image
docker compose -f deploy/docker-compose.yml --env-file deploy/.env build keynv-server

# Bootstrap the org + owner. Password via env, NOT argv.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env run --rm \
  -e KEYNV_BOOTSTRAP_PASSWORD='your-12-plus-char-password' \
  keynv-server \
  node dist/bootstrap.js --owner-email lead@team.test --org-name acme

# Start the stack
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d

# Verify
curl http://localhost:8080/v1/health
```

## What's in the stack

| Service | Image | Notes |
|---|---|---|
| `keynv-server` | `keynv-server:local` (built from `apps/server/Dockerfile`) | Multi-stage Alpine, runs as a non-root `keynv` user, healthchecks `/v1/health` every 30s. |
| `litestream` | `litestream/litestream:0.3.13` | Reads `keynv.db` read-only via the shared `keynv-data` volume, replicates the WAL to S3/B2 with 1s sync interval. Comment out if you don't need backup. |

The shared `keynv-data` volume holds:

```
/data/keynv.db        the SQLite database (encrypted-at-rest at the column level)
/data/keynv.db-wal    write-ahead log
/data/keynv.db-shm    shared memory file
/data/master.key      the master KEK (mode 0400, never replicated)
```

## Operations

```bash
docker compose logs -f keynv-server     # tail server logs
docker compose logs -f litestream       # tail backup uploader
docker compose restart keynv-server     # zero-downtime is not implemented; ~2s
docker compose down                     # stop everything (data preserved)
docker compose down -v                  # DESTRUCTIVE — deletes the volume
```

## Behind a TLS proxy

This compose file does NOT include TLS termination. In production, run Caddy / nginx / Traefik on the same host and reverse-proxy `https://keynv.your-domain.com` → `http://keynv-server:8080`. A Caddy template lives in `deploy/caddy.example.Caddyfile`.

## Resource sizing

- 15-person team, ~50 audit rows / day: 1 vCPU / 1 GB RAM / 10 GB disk.
- 50–100 users: 2 vCPU / 2 GB RAM.
- Beyond 100 users or multi-region: consider the Phase 6 Postgres adapter.

See also: [Disaster recovery](/deploy/disaster-recovery/) — the full Litestream restore walkthrough.
