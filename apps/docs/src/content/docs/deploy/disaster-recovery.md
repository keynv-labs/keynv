---
title: Disaster recovery
description: Restore from a Litestream backup. Master KEK is the only thing keynv can't restore for you.
sidebar:
  order: 4
---

## What gets lost when

| Loss | Recoverable from | Consequence |
|---|---|---|
| `keynv.db` (corruption, accidental delete, host failure) | Litestream replica in S3/B2 | Restore in seconds; RPO ≈ 1s with 1s sync interval. |
| Volume / disk loss | Litestream replica | Same as above. |
| Whole VM gone | Litestream replica + master.key copy | Spin up a new VM, restore, reuse the master.key. |
| **`master.key` lost** | The off-host copy you made at bootstrap time | **Without master.key, every wrapped DEK is unrecoverable. Every secret is gone.** |

`master.key` is **never replicated by Litestream**. This is by design — replicating it would defeat the threat model. Make a copy when you bootstrap; store it in a separate password manager / hardware token / printed in a safe.

## Restore from Litestream

```bash
# 1. Stop the stack
docker compose -f deploy/docker-compose.yml down

# 2. Make sure the master.key is in place at /data/master.key inside
#    the volume (it's the key file you saved off-host).
#    For a fresh VM:
docker compose -f deploy/docker-compose.yml run --rm --entrypoint sh keynv-server
> cp /path/to/your/restored/master.key /data/master.key
> chmod 0400 /data/master.key
> exit

# 3. Restore the database from S3/B2
docker run --rm \
  -v keynv_keynv-data:/data \
  -v $(pwd)/deploy/litestream.yml:/etc/litestream.yml:ro \
  -e LITESTREAM_ACCESS_KEY_ID -e LITESTREAM_SECRET_ACCESS_KEY \
  -e LITESTREAM_BUCKET -e LITESTREAM_ENDPOINT -e LITESTREAM_REGION \
  litestream/litestream:0.3.13 \
  restore -config /etc/litestream.yml /data/keynv.db

# 4. Start back up
docker compose -f deploy/docker-compose.yml up -d

# 5. Verify
curl http://localhost:8080/v1/health
keynv login --server http://localhost:8080 --email lead@team.test
keynv audit verify
# OK: N entries verified
```

If `keynv audit verify` reports a broken chain after restore, the most common cause is replication lag — try restoring from a slightly earlier snapshot. Litestream stores snapshots at the configured `snapshot-interval` (10m by default).

## Periodic recovery drill

Don't trust a backup you haven't restored from. Quarterly drill:

1. Spin up a clone of the production VM.
2. Run the restore steps above against a **read-only** copy of the S3 bucket (or the prod bucket with care).
3. Compare the row count of every table against production.
4. Run `keynv audit verify` end-to-end.
5. Tear the clone down.

## What you can't recover

The two scenarios where keynv cannot help:

1. **Lost master.key with no off-host copy.** Every DEK becomes unrecoverable. Plan for this at bootstrap time.
2. **Compromised master.key.** If someone exfiltrated the key, every backup snapshot is now decryptable by them. Rotate keys immediately (`keynv kek rotate`, Phase 6 commercial), revoke and reissue every secret, and audit access from the suspected exposure window forward.
