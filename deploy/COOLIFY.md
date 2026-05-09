# Deploying keynv on Coolify

This is the deploy path the project actually targets. Coolify pulls this repo,
builds the server image with the existing `apps/server/Dockerfile`, and runs it
behind its own Caddy/Traefik proxy (HTTPS handled automatically).

End-state: a running keynv-server reachable at `https://keynv.<your-domain>`,
with a persistent volume for the SQLite DB + master key, ready for the CLI to
log in against.

---

## 0) Prerequisites

- A Coolify instance you can log into (self-hosted, any version ≥ v4)
- A server registered in Coolify with at least 1 vCPU / 1 GB RAM / 10 GB free
- A GitHub source connected in Coolify pointing at `keynv-labs/keynv` (private
  source if your fork is private; public works too)
- A domain or subdomain you can point at the Coolify server (e.g. `keynv.example.com`)

---

## 1) Generate two secrets (do this once, locally)

You need:

```bash
# JWT signing secret (32+ chars, used to sign CLI access tokens)
openssl rand -base64 48

# Owner login password (12+ chars, what you'll log in with from the CLI)
openssl rand -base64 24
```

Copy both. The JWT secret you'll never see again; the owner password you'll
type into `keynv login`. Save them in your password manager now.

> The `master.key` (the encryption KEK that protects every secret in the DB)
> is **not** generated here. The server auto-creates it on first start using
> the env vars in the next step. Store it off-host once it exists (§6).

---

## 2) Create the resource in Coolify

In the Coolify UI:

1. **Project → New Resource → Docker Compose Empty** (or "From Git Repository"
   if you want Coolify to watch the branch and auto-redeploy on push).
2. **Source**: select your `keynv-labs/keynv` GitHub source. Branch: `main`.
3. **Compose file path**: `deploy/coolify.yml`
4. **Build pack**: Docker Compose (auto-detected).

Save. Don't deploy yet — env vars come next.

---

## 3) Set the environment variables

In the resource's **Environment Variables** tab, add:

| Key | Value | Notes |
|---|---|---|
| `KEYNV_JWT_SECRET` | (the `openssl rand -base64 48` output from §1) | **Mark as secret** |
| `KEYNV_BOOTSTRAP_OWNER_EMAIL` | `you@example.com` | Your login email |
| `KEYNV_BOOTSTRAP_OWNER_PASSWORD` | (the `openssl rand -base64 24` output from §1) | **Mark as secret** |
| `KEYNV_BOOTSTRAP_ORG_NAME` | `your-team` | Optional, defaults to `default` |
| `KEYNV_LOG_LEVEL` | `info` | Change to `debug` if you need to debug something |

The `KEYNV_BOOTSTRAP_*` trio triggers a one-time auto-bootstrap on first start:
the server detects that `/data/master.key` is missing, generates it, runs DB
migrations, and creates the owner account. On every subsequent restart the
master.key file exists, so the bootstrap logic is a no-op even if you leave the
env vars set. Cleaner habit: blank them out after §7 verifies success.

---

## 4) Configure the domain

In the resource's **Domains** tab:

- **Domain**: `https://keynv.<your-domain>`
- **Port mapping**: `8080` (the container's exposed port)

Coolify provisions a Let's Encrypt cert automatically. If your DNS isn't yet
pointing at the Coolify server, do that now — an `A` record for
`keynv.<your-domain>` → Coolify server's public IP.

---

## 5) First deploy (auto-bootstraps itself)

Hit **Deploy**. Coolify will:

1. Clone the repo at the chosen branch
2. Run `docker compose -f deploy/coolify.yml build` (~3-5 min first time)
3. Start the container
4. Server detects `/data/master.key` is missing and the `KEYNV_BOOTSTRAP_*`
   env vars are set → auto-bootstrap fires:
   - generates `/data/master.key` (32 random bytes, the root KEK)
   - runs Drizzle migrations on the empty DB
   - creates the org row + the owner user (Argon2id-hashed password)
5. Server starts listening on `:8080`
6. Healthcheck (`GET /v1/health` -> 200) passes
7. Coolify proxies `https://keynv.<your-domain>` -> container:8080

Watch the deploy log. You should see:

```
[auto-bootstrap] master key missing - initializing fresh deployment
[auto-bootstrap] created org "your-team" (id=org_...)
[auto-bootstrap] created owner you@example.com (id=u_...)
keynv-server listening on http://localhost:8080
```

If the bootstrap env vars weren't set, the server fails fast with a clear
message in the log. Re-check §3 and redeploy.

---

## 6) Save the master key off-host (CRITICAL, do this now)

The encryption story depends on the master key file living somewhere
**other** than the SQLite DB. Open the Coolify Terminal for the
keynv-server resource and run:

```bash
cat /data/master.key | base64
```

Copy the base64 output and store it in your password manager (1Password,
Bitwarden — NOT another keynv instance, NOT in this repo). If you ever lose
this file AND the DB you can't recover any secret, even with backups.

To restore later: write the base64-decoded bytes back to `/data/master.key`
on a new container that has the matching DB.

Coolify volume backups (and Litestream, when you add it in §10) replicate
the DB but **deliberately not** the master key — keeping them apart is the
whole point of envelope encryption.

---

## 7) Verify

From your laptop:

```bash
curl https://keynv.<your-domain>/v1/health
# {"ok":true,"version":"...","db":"ok"}
```

Healthcheck passing in Coolify's UI means everything wired up correctly.

After verification, go back to **Environment Variables** in Coolify and blank
out (or delete) `KEYNV_BOOTSTRAP_OWNER_PASSWORD` so it's not sitting in the
deployment config any longer than necessary. The auto-bootstrap is idempotent
on subsequent restarts (master.key now exists), so removing the var is safe.

---

## 8) Connect the CLI

On your laptop:

```bash
keynv config set server-url https://keynv.<your-domain>
keynv login --email you@example.com
# (enter the password from §1)

# Smoke test
keynv project create demo
keynv secret create @demo.dev.test --value 'hello-from-coolify'
keynv secret get @demo.dev.test
# → hello-from-coolify
```

If this all works, the deploy is done. Use it.

---

## 9) Updating later

When you push new commits to `main`:

- **Auto-deploy**: enable "Auto Deploy on Push" in the resource settings if
  you set up Coolify with the GitHub source. Every push to main → Coolify
  rebuilds + redeploys.
- **Manual**: hit **Deploy** in the resource UI.

The persistent volume (`keynv-data`) survives redeploys — you don't lose your
DB, master key, or audit log.

DB schema migrations run automatically on container boot (Drizzle's
`migrate()` runs in `dist/index.js` startup), so you don't need a separate
migration step.

---

## 10) Backups (add later, not now)

For day one you can skip this. When you do want offsite backup, two options:

- **Litestream sidecar**: spin up a second Coolify resource using the original
  `deploy/docker-compose.yml` litestream service, mounting the same `/data`
  volume read-only. Replicates the SQLite WAL to S3/B2 in real time.
- **Volume snapshot**: Coolify supports periodic volume backups via Restic /
  rclone. Configure under **Server → Backups**. Less granular than Litestream
  but no S3 setup needed if you have Backblaze/SFTP.

Do **NOT** back up `master.key` to the same place as the DB. Keep them
separated — that's the whole point of envelope encryption.

---

## 11) Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on `pnpm install` | Lockfile out of sync | `pnpm install` locally, commit `pnpm-lock.yaml`, redeploy |
| Healthcheck never passes, server crashes in a loop | Bootstrap env vars missing | Verify `KEYNV_BOOTSTRAP_OWNER_EMAIL` + `KEYNV_BOOTSTRAP_OWNER_PASSWORD` in Coolify env, redeploy |
| `/v1/health` returns 500 with `db: error` | Volume not persisted between restarts | Check that the `keynv-data` Docker volume is mounted at `/data` (Coolify shows persistent volumes in the resource UI) |
| `KEYNV_JWT_SECRET: String must contain at least 32 character(s)` in logs | Env var not set or too short | Set per §3 (use `openssl rand -base64 48`), redeploy |
| `KEYNV_BOOTSTRAP_OWNER_PASSWORD must be at least 12 characters` | Bootstrap password too short | Use a 12+ char password, redeploy |
| TLS cert fails | DNS not propagated yet | Wait 5–30 min, check `dig keynv.your-domain` |
| Container OOM during build | better-sqlite3 + argon2 native compile is RAM-hungry | Bump Coolify build-time RAM limit; runtime needs only ~256 MB |
| Login returns 401 even with correct password | Wrong owner email, or bootstrap ran twice with different passwords | Check Coolify Terminal: `sqlite3 /data/keynv.db 'SELECT email FROM users'`. If wrong, you'll need to wipe `/data/*` and redeploy (loses all data) |

---

## What this guide intentionally does NOT cover

- **Web UI deploy** — `apps/web` is unfinished (no Dockerfile, no `output: 'standalone'`
  in `next.config.ts`). The CLI is the supported interface for now. Add web UI as a
  second Coolify resource when ready.
- **Multi-region / HA** — single container, single SQLite file. Good for ≤50
  users. Beyond that, see the Phase 6 Postgres adapter plan in
  `docs/phases/06-commercial-tier.md`.
- **GitHub Actions / signed releases** — moved to `.github/workflows.disabled/`
  while the project is in personal-use phase. Restore them before any public
  OSS launch (see that directory's README).
