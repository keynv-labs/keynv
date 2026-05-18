# Backup and Restore Runbook

This runbook is for self-hosted keynv deployments that use SQLite with the
optional Litestream sidecar from `deploy/docker-compose.yml`.

The database backup and the master KEK backup are intentionally separate:

- `keynv.db` and Litestream replicas contain ciphertext, wrapped project DEKs,
  users, memberships, approvals, and audit rows.
- `master.key` contains the 32-byte master KEK that unwraps project DEKs.
- Litestream does **not** replicate `master.key`.
- A database backup without the matching `master.key` cannot decrypt secrets.
- A `master.key` without the matching database cannot reconstruct deleted rows.

## Recovery Targets

| Topology | Expected RPO | Expected RTO | Notes |
|---|---:|---:|---|
| Docker Compose + Litestream | 1-10 seconds | 15-30 minutes | Litestream `sync-interval` is `1s`; actual RPO depends on object store availability and network lag. |
| Docker Compose + volume snapshot only | Snapshot interval | 30-60 minutes | RPO is the schedule of your host or object-store snapshot. |
| No off-host database backup | No guarantee | No guarantee | A lost volume means lost data, even if `master.key` survived. |

These are operational targets, not a contractual SLA. Record your actual drill
times in your incident log and adjust the target if your object store, host, or
team process is slower.

## What To Back Up

| Asset | Back up with | Store with DB backup? | Why |
|---|---|---:|---|
| `/data/keynv.db` | Litestream or host volume snapshot | yes | Primary SQLite database. |
| SQLite WAL/checkpoint state | Litestream | yes | Needed for point-in-time restore. |
| `/data/master.key` | Password manager or offline secret store | no | Root KEK; store separately from the DB backup. |
| `deploy/.env` values | Password manager or infra secret store | no | Contains JWT/bootstrap/object-store credentials. |
| Release artifacts | GitHub Releases / container registry | n/a | Re-deploy from signed release artifacts. |

Do not store `master.key` in the same S3 bucket, B2 bucket, host backup, or
Coolify backup job that stores `keynv.db`.

## Baseline Checks

Run these checks weekly and before planned maintenance.

```bash
# Server readiness: DB is reachable and migrations have completed.
curl -fsS https://api.example.com/v1/health/ready

# Litestream process health.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs --tail=50 litestream

# Confirm the database and master key exist in the persistent volume.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env \
  exec keynv-server ls -l /data/keynv.db /data/master.key
```

`/metrics` should also expose recent HTTP traffic and domain events when
Prometheus scraping is configured.

## Master KEK Backup Procedure

Perform this once after first bootstrap and after any future KEK rotation.

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env \
  exec keynv-server sh -lc 'base64 /data/master.key'
```

Store the base64 output in a password manager entry named clearly, for example
`keynv production master.key`. Do not paste the value into a ticket, chat,
commit, shell script, or `.env` file.

Verify the stored copy without printing the key value:

```bash
# On the server.
docker compose -f deploy/docker-compose.yml --env-file deploy/.env \
  exec keynv-server sh -lc 'sha256sum /data/master.key'

# In a private operator shell after copying the password-manager value locally.
# This prints only the digest, not the key bytes.
printf '%s' '<base64-from-password-manager>' | base64 -d | sha256sum
```

The digests must match. Delete any local temporary file or shell variable used
for the comparison.

## Restore Drill

Run a drill at least monthly for production and after every backup tooling
change. Use an isolated host, separate DNS name, and separate object-store
credentials where possible. Do **not** point a drill server at production users.

1. Record the current smoke secret hash on a trusted operator machine.

```bash
keynv secret get @project.dev.SMOKE_TEST | sha256sum
```

This prints only a digest. The secret value still passes through the local
process pipeline, so run it only on a trusted operator machine.

2. Stop the drill stack if it already exists.

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env down
```

3. Restore the database from Litestream into the drill volume.

```bash
docker run --rm -v keynv_keynv-data:/data alpine:3.20 \
  sh -lc 'rm -f /data/keynv.db /data/keynv.db-wal /data/keynv.db-shm'

docker run --rm \
  -v keynv_keynv-data:/data \
  -v "${PWD}/deploy/litestream.yml:/etc/litestream.yml:ro" \
  -e LITESTREAM_ACCESS_KEY_ID \
  -e LITESTREAM_SECRET_ACCESS_KEY \
  -e LITESTREAM_BUCKET \
  -e LITESTREAM_ENDPOINT \
  -e LITESTREAM_REGION \
  litestream/litestream:0.3.13 \
  restore -config /etc/litestream.yml -o /data/keynv.db /data/keynv.db
```

If you need a point-in-time restore, add Litestream's restore timestamp option
according to the Litestream version you operate.

4. Restore the matching `master.key` from the password manager.

```bash
docker run --rm -i -v keynv_keynv-data:/data alpine:3.20 sh -lc \
  'base64 -d > /data/master.key && chmod 400 /data/master.key'
```

Paste the base64 value into stdin, then send EOF. Do not place the key value on
the command line.

5. Start the drill stack.

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

6. Run post-restore validation.

Make sure the `keynv` CLI profile used for this step points at the drill API,
not the production API.

```bash
curl -fsS https://drill-api.example.com/v1/health/ready
keynv audit verify
keynv secret get @project.dev.SMOKE_TEST | sha256sum
```

The smoke secret digest must match the digest from step 1. Do not print the
secret value in the incident channel or drill report.

7. Confirm that writes still work on the drill stack.

```bash
keynv project create restore-drill
keynv secret create @restore-drill.dev.PROBE --value 'temporary-drill-value'
keynv secret delete @restore-drill.dev.PROBE --force
```

8. Record the drill result.

Capture at least:

- date/time of restore
- source backup and restore point
- observed RPO
- observed RTO
- `audit verify` result
- smoke secret hash comparison result
- operator name
- follow-up actions

## Production Restore

Use this during an actual outage after deciding that the primary SQLite volume
is lost or corrupted.

1. Freeze writes and tell users the service is in restore mode.

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env down
```

2. Preserve the broken volume for forensics if possible.

```bash
docker run --rm -v keynv_keynv-data:/data -v "${PWD}:/backup" alpine:3.20 \
  sh -lc 'tar czf /backup/keynv-broken-volume.tgz -C /data .'
```

3. Restore `keynv.db` from Litestream or your volume snapshot.

```bash
docker run --rm -v keynv_keynv-data:/data alpine:3.20 \
  sh -lc 'rm -f /data/keynv.db /data/keynv.db-wal /data/keynv.db-shm'

docker run --rm \
  -v keynv_keynv-data:/data \
  -v "${PWD}/deploy/litestream.yml:/etc/litestream.yml:ro" \
  -e LITESTREAM_ACCESS_KEY_ID \
  -e LITESTREAM_SECRET_ACCESS_KEY \
  -e LITESTREAM_BUCKET \
  -e LITESTREAM_ENDPOINT \
  -e LITESTREAM_REGION \
  litestream/litestream:0.3.13 \
  restore -config /etc/litestream.yml -o /data/keynv.db /data/keynv.db
```

4. Restore the matching `master.key` if the volume copy is missing or suspect.

```bash
docker run --rm -i -v keynv_keynv-data:/data alpine:3.20 sh -lc \
  'base64 -d > /data/master.key && chmod 400 /data/master.key'
```

5. Start the server and wait for readiness.

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
curl -fsS https://api.example.com/v1/health/ready
```

6. Validate before reopening writes.

```bash
keynv audit verify
keynv secret list project
keynv secret get @project.dev.SMOKE_TEST | sha256sum
```

7. Reopen service and announce the observed restore point.

Include the restore timestamp and whether any writes after that timestamp need
to be re-created.

## Post-Restore Checklist

- `/v1/health/ready` returns 200.
- `/metrics` is being scraped again.
- `keynv audit verify` returns `OK`.
- A known smoke secret resolves to the expected digest without printing the
  value.
- A temporary write and delete succeeds.
- Application logs show no repeated DB, migration, or crypto errors.
- Litestream replication has resumed from the restored database.
- The incident report records RPO, RTO, restore point, and any lost writes.

## KEK Loss Decision Tree

Use this decision tree when `/data/master.key` is missing, corrupt, or suspected
lost.

| Situation | Action |
|---|---|
| `master.key` file exists and server boots | Back it up immediately to the password manager and verify the digest. |
| `master.key` file is missing, but a verified password-manager backup exists | Restore the backup to `/data/master.key`, set mode `0400`, restart, and run the post-restore checklist. |
| `master.key` file is corrupt, but a verified backup exists | Stop the server, preserve the corrupt file for forensics, restore the verified backup, restart, and validate. |
| `master.key` is lost and no backup exists, but the old server is still running | Treat this as an emergency. Stop nonessential changes, take a DB snapshot, and export/re-enter secrets through approved operational channels. There is no supported command to recover the KEK from process memory. |
| `master.key` is lost, no backup exists, and the server is down | Existing wrapped DEKs are unrecoverable. Recreate the deployment and re-enter secrets from original providers. |
| `master.key` may be exposed to an attacker | Consider all secrets readable if the attacker also has the DB. Rotate affected upstream credentials, rebuild the deployment, and re-enter secrets. OSS keynv does not yet ship an online KEK rotation command. |

## KEK Rotation Status

The current OSS deployment stores one master KEK in `/data/master.key`. Online
KEK rotation is planned but not implemented in the CLI/server yet. Until that
ships, a suspected master-key exposure should be handled as a credential
incident:

1. Freeze keynv writes.
2. Rotate upstream credentials at their providers.
3. Create a fresh keynv deployment with a new `master.key`.
4. Re-enter rotated secret values.
5. Retire the old deployment after audit/export requirements are satisfied.

## Drill Schedule

| Environment | Frequency | Minimum evidence |
|---|---|---|
| Production | Monthly | Restore point, RPO/RTO, audit verify output, smoke digest comparison. |
| Staging | After backup config changes | Restore point, readiness check, smoke digest comparison. |
| Personal/dev | Best effort | Confirm `master.key` backup exists before storing real secrets. |

Missed drills should be treated as operational risk, not documentation debt.
