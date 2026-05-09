# Deploy keynv on Coolify

Self-host the keynv server on a Coolify instance. Your CLI on your laptop talks
to it over HTTPS; encrypted secrets live in a SQLite file inside a persistent
volume that survives redeploys.

**Time:** about 15 minutes, mostly waiting on the first Docker build.
**Result:** `https://keynv.<your-domain>` answering CLI logins.

```
   ┌──────────────────┐                   ┌─────────────────────────────────┐
   │  YOUR LAPTOP     │      HTTPS        │  COOLIFY SERVER                 │
   │  ──────────────  │ ─────────────────▶│  ──────────────                 │
   │  keynv CLI       │                   │                                 │
   │                  │                   │   ┌───────────────────────────┐ │
   │  - login         │                   │   │ keynv-server container    │ │
   │  - secret get    │                   │   │  - Hono API on :8080      │ │
   │  - secret create │                   │   │  - argon2id user auth     │ │
   │                  │                   │   │  - envelope-encrypted     │ │
   │                  │                   │   │    SQLite vault           │ │
   │                  │                   │   └───────────────────────────┘ │
   │                  │                   │             │                   │
   │                  │                   │             ▼                   │
   │                  │                   │   /data  (persistent volume)    │
   │                  │                   │   ├─ keynv.db    (encrypted)    │
   │                  │                   │   └─ master.key  (root KEK)     │
   └──────────────────┘                   └─────────────────────────────────┘
```

---

## What you need before you start

| | |
|---|---|
| Coolify instance | v4+, you can sign in |
| Server | 1 vCPU / 1 GB RAM / 10 GB free disk (less is OK at runtime, build is the spike) |
| DNS | a subdomain `keynv.<your-domain>` with an A record pointing at the Coolify server's public IP |
| GitHub source | this repo accessible to Coolify (public works; private repos need a connected GitHub source) |

You do **not** need GitHub Actions, a container registry, a Helm chart, S3, or
Litestream. Coolify clones the repo, builds the image with the existing
`apps/server/Dockerfile`, and runs it.

---

## Step 1 — Generate two secrets, locally

Run on your laptop. **Save both into your password manager before continuing.**

```bash
# (a) JWT signing secret — the server signs every CLI access token with this.
openssl rand -base64 48

# (b) Owner login password — what YOU will type into `keynv login`.
openssl rand -base64 24
```

The JWT secret is opaque infrastructure; you'll never see it again, and rotating
it later signs every existing CLI session out. The owner password is your
front-door login — keep it where you keep your other passwords.

> A third secret — the **master encryption key** that wraps every project's
> data encryption key — is not created here. The server generates it inside
> the container on first start (Step 5) and you'll back it up off-host in
> Step 6.

---

## Step 2 — Create the resource in Coolify

In the Coolify UI:

1. **Project → New Resource → Docker Compose Empty** (or *From Git Repository*
   if you want Coolify to auto-redeploy on every push to `main`).
2. **Source:** the connected GitHub source pointing at this repo.
3. **Branch:** `main`.
4. **Compose file path:** `deploy/coolify.yml`.

Save. **Don't deploy yet** — environment variables come next, and the server
needs them on first start.

---

## Step 3 — Set environment variables

In the resource's **Environment Variables** tab:

| Key | Value | Why it matters |
|---|---|---|
| `KEYNV_JWT_SECRET` | output of `openssl rand -base64 48` from Step 1 | Server signs/verifies CLI access tokens with this. Mark as secret. |
| `KEYNV_BOOTSTRAP_OWNER_EMAIL` | your login email | The first user account auto-bootstrap creates. |
| `KEYNV_BOOTSTRAP_OWNER_PASSWORD` | output of `openssl rand -base64 24` from Step 1 | Your `keynv login` password (Argon2id-hashed before storage). Mark as secret. 12+ chars required. |
| `KEYNV_BOOTSTRAP_ORG_NAME` | e.g. `acme` | Org name attached to the owner. Optional, defaults to `default`. |
| `KEYNV_LOG_LEVEL` | `info` | Set to `debug` while troubleshooting. |

### How the BOOTSTRAP_* vars work

On every container start, the server checks for `/data/master.key`.

- **File missing + bootstrap vars set** → auto-bootstrap fires: generates the
  master key, runs DB migrations, inserts the org row, inserts the owner
  user. Server then starts normally.
- **File present** → bootstrap logic is a no-op (this is the steady state on
  every restart after the first one).
- **File missing + bootstrap vars unset** → server fails fast with a clear
  message in the log. Set the vars and redeploy.

After Step 7 confirms success, you can blank out
`KEYNV_BOOTSTRAP_OWNER_PASSWORD` — clearing it never hurts because the master
key file already exists, so the bootstrap branch is dead code from then on.

---

## Step 4 — Point a domain at it

In the resource's **Domains** tab:

- **Domain:** `https://keynv.<your-domain>`
- **Port:** `8080` (the container's exposed port)

Coolify's reverse proxy provisions a Let's Encrypt cert for this subdomain
automatically. If the DNS A record for `keynv.<your-domain>` isn't already
pointing at the Coolify server, add it now — TLS provisioning fails until DNS
resolves.

---

## Step 5 — Deploy

Click **Deploy**. Coolify will:

1. Clone the repo at `main`.
2. Run `docker compose -f deploy/coolify.yml build`. The first build takes 3–5
   minutes — Node and the better-sqlite3 / argon2 native modules need to
   compile. Subsequent builds are seconds.
3. Start the container.
4. The server reads env, sees `/data/master.key` is missing, sees the
   bootstrap vars are set, runs auto-bootstrap, then begins serving on `:8080`.
5. The healthcheck (`GET /v1/health` → 200) flips green.
6. Coolify routes `https://keynv.<your-domain>` → container `:8080`.

You should see this in the deploy log:

```
[auto-bootstrap] master key missing - initializing fresh deployment
[auto-bootstrap] created org "acme" (id=org_...)
[auto-bootstrap] created owner you@example.com (id=u_...)
keynv-server listening on http://localhost:8080
```

If you don't see those lines, the troubleshooting table at the bottom covers
the common cases.

---

## Step 6 — Back up the master key OFF-HOST (do this NOW)

The master key encrypts every project's data-encryption key, which encrypts
every secret. **Lose the master key and the DB at the same time, and no backup
recovers anything.** The system is designed this way on purpose — DB backups
and Litestream replication deliberately exclude the key, so a leaked backup is
worthless without it. That guarantee only works if you keep the key somewhere
keynv itself doesn't run.

Open the Coolify **Terminal** for the keynv-server resource:

```bash
cat /data/master.key | base64
```

Copy the base64 output. Paste it into your password manager under a clear
label (`keynv master.key — backup`). Don't email it, don't put it in this
repo, don't store it on the same Coolify server.

To restore later (new server, lost volume): write the base64-decoded bytes
back to `/data/master.key` on a fresh container that has the matching
restored DB.

---

## Step 7 — Verify

From your laptop:

```bash
curl https://keynv.<your-domain>/v1/health
# {"ok":true,"version":"...","db":"ok"}
```

If you get that JSON back, the server is fully up. Healthcheck green in
Coolify confirms it.

Now go back to **Environment Variables** in Coolify and blank out
`KEYNV_BOOTSTRAP_OWNER_PASSWORD`. The bootstrap branch is unreachable now
that the master key exists, so removing the var won't break anything — it
just keeps the password out of the deployment config.

---

## Step 8 — Connect the CLI

On your laptop:

```bash
keynv config set server-url https://keynv.<your-domain>
keynv login --email you@example.com
# paste the owner password from Step 1

# smoke test
keynv project create demo
keynv secret create @demo.dev.test --value 'hello-from-coolify'
keynv secret get @demo.dev.test
# → hello-from-coolify
```

All three commands working means the deployment is done. Start using it for
real secrets.

---

## Updating later

When you push commits to `main`:

- **Auto:** enable *Auto Deploy on Push* in the resource settings if you used
  the Git source. Every push to `main` triggers rebuild + redeploy.
- **Manual:** click **Deploy** in the resource UI.

Drizzle migrations run on every container boot, so schema changes ship with
the code. The `keynv-data` volume survives redeploys, so your DB, master key,
and audit log persist.

---

## Backups (add when you need them, not now)

Skip this on day one. When you do want offsite backup:

- **Litestream sidecar** — real-time SQLite WAL replication to S3 or
  Backblaze B2. Spin up a second Coolify resource using the litestream
  service from `deploy/docker-compose.yml`, mounting the same `/data` volume
  read-only.
- **Volume snapshot** — Coolify's built-in periodic Restic/rclone backups
  under *Server → Backups*. Less granular than Litestream, but no S3 setup.

Whichever you pick: **never** put the master key in the same backup as the
DB. The whole encryption story depends on those being separated. Your
password manager copy from Step 6 is enough.

---

## When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on `pnpm install` | Lockfile out of sync | `pnpm install` locally, commit `pnpm-lock.yaml`, redeploy |
| Server crash-loops on first deploy | Bootstrap env vars missing, or password under 12 chars | Re-check Step 3, redeploy |
| `KEYNV_JWT_SECRET: String must contain at least 32 character(s)` in logs | JWT secret too short | Use `openssl rand -base64 48`, redeploy |
| `/v1/health` returns 500 with `"db":"error"` | Volume not persisted between restarts | Confirm the `keynv-data` volume is mounted at `/data` in the Coolify resource UI |
| TLS cert provisioning fails | DNS not propagated | Wait 5–30 minutes, then `dig keynv.<your-domain>` to confirm the A record resolves to the Coolify IP |
| Build OOM | better-sqlite3 + argon2 native compile is RAM-hungry | Bump build-time RAM to ≥ 1 GB; runtime needs only ~256 MB |
| Login returns 401 with the right password | Wrong owner email recorded, or DB / env mismatch | Coolify Terminal: `sqlite3 /data/keynv.db 'SELECT email FROM users'`. If the email is wrong, the only clean fix is to wipe `/data/*` and redeploy — this loses all data |

---

## What this guide deliberately doesn't cover

- **Web UI** — `apps/web` isn't Docker-ready yet (no `output: 'standalone'`,
  no Dockerfile). The CLI is the supported interface for now; we'll add a
  second Coolify resource for the UI once it's ready.
- **HA / multi-region** — single container, single SQLite. Comfortably
  handles a 15-person team. Beyond ~50 users, see the Phase 6 Postgres
  adapter plan in `docs/phases/06-commercial-tier.md`.
- **GitHub Actions / signed releases** — paused in
  `.github/workflows.disabled/` during this personal-use phase. They come
  back before any public OSS launch.
