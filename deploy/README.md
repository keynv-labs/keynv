# Self-host deployment

Two supported paths:

- **[Coolify](./COOLIFY.md)** (recommended for personal/team self-hosting) — Coolify
  pulls the repo, builds the image, handles HTTPS + the persistent volume, and
  the server auto-bootstraps on first start from env vars. No shell-step
  required after deploy.
- **Plain Docker Compose** (this guide, below) — single-VM stack with the
  keynv-server container plus an optional Litestream sidecar replicating the
  SQLite WAL to S3/B2 for disaster recovery. Bootstrap is a separate one-shot
  command.

Pick Coolify if you have a Coolify instance; pick plain compose if you want
full control over the host.

## First-time bring-up

```bash
# 1. configure
cp deploy/.env.example deploy/.env
$EDITOR deploy/.env
# Required: KEYNV_JWT_SECRET (32+ chars, e.g. `openssl rand -base64 32`).
# Optional: Litestream S3 creds. Leave blank and comment out the
# litestream service in docker-compose.yml if you don't have S3 yet.

# 2. build the server image
docker compose -f deploy/docker-compose.yml --env-file deploy/.env build keynv-server

# 3. bootstrap the org + owner + master KEK
docker compose -f deploy/docker-compose.yml --env-file deploy/.env run --rm \
  -e KEYNV_BOOTSTRAP_PASSWORD='your-12-plus-char-password' \
  keynv-server \
  node dist/bootstrap.js --owner-email lead@team.test --org-name acme

# 4. start the stack
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d

# 5. verify
curl http://localhost:8080/v1/health
# {"ok":true,"version":"...","db":"ok"}
```

## Ops

| Action | Command |
|---|---|
| Tail server logs | `docker compose logs -f keynv-server` |
| Tail Litestream logs | `docker compose logs -f litestream` |
| Restart server | `docker compose restart keynv-server` |
| Stop everything | `docker compose down` |
| Stop + delete data | `docker compose down -v` (DESTRUCTIVE — wipes the volume incl. master.key) |
| Inspect master key file (host) | `docker compose exec keynv-server ls -l /data/master.key` |

## Disaster recovery

If the server-side `keynv.db` is lost or corrupted:

```bash
# 1. stop the stack
docker compose down

# 2. restore from Litestream
docker run --rm \
  -v keynv_keynv-data:/data \
  -e LITESTREAM_ACCESS_KEY_ID -e LITESTREAM_SECRET_ACCESS_KEY \
  -e LITESTREAM_BUCKET -e LITESTREAM_ENDPOINT -e LITESTREAM_REGION \
  litestream/litestream:0.3.13 \
  restore -config /etc/litestream.yml -o /data/keynv.db /data/keynv.db

# 3. start back up
docker compose up -d
```

The master.key file is **NOT** replicated by Litestream by design — losing it would lock you out, so the operator is responsible for storing a copy off-host (e.g., in a separate password manager). If you lose master.key, the restored DB is unreadable.

## Behind a TLS proxy

This compose file does not include a TLS reverse proxy. In production:

- Run nginx / Caddy / Traefik on the same host
- Proxy `https://keynv.your-domain.com` → `http://keynv-server:8080`
- Set the public CLI/web `KEYNV_SERVER_URL` to the public HTTPS URL

A worked example (Caddy) lives in `deploy/caddy.example.Caddyfile`.

## Resource sizing

For a 15-person team:
- 1 vCPU / 1 GB RAM / 10 GB disk is plenty
- ~50 audit rows/day, <100 KB/day SQLite growth
- Litestream uploads <10 MB/day to S3 typically

For 50–100 users you'll want 2 vCPU / 2 GB RAM. Beyond that, consider the Phase 6 Postgres adapter.
