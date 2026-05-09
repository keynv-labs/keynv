---
title: Kubernetes (Helm)
description: Helm chart for keynv-server; designed for a single replica today (SQLite + WAL is single-writer).
sidebar:
  order: 2
---

## Install from the chart

```bash
helm repo add keynv https://charts.keynv.dev
helm repo update

# Generate a JWT secret if you don't have one
KEYNV_JWT_SECRET=$(openssl rand -base64 32)

helm install keynv keynv/keynv \
  --namespace keynv --create-namespace \
  --set server.jwtSecret="$KEYNV_JWT_SECRET" \
  --set server.persistence.size=10Gi \
  --set ingress.enabled=true \
  --set ingress.host=keynv.your-domain.com
```

## Bootstrap (one-time)

```bash
kubectl exec -n keynv deploy/keynv-server -- \
  env KEYNV_BOOTSTRAP_PASSWORD='your-12-plus-char-password' \
  node /app/dist/bootstrap.js --owner-email lead@team.test --org-name acme
```

## Architecture today

- Single replica (StatefulSet). SQLite + WAL is single-writer; multi-replica needs the Phase 6 Postgres adapter.
- Persistent volume for `/data` (default 10 GiB).
- Optional Ingress with cert-manager-managed TLS.
- Litestream as a sidecar container if you set `litestream.enabled=true`.

## values.yaml highlights

```yaml
image:
  repository: ghcr.io/keynv-org/keynv-server
  tag: ""           # defaults to chart appVersion
  pullPolicy: IfNotPresent

server:
  jwtSecret: ""     # required; created as a Secret
  logLevel: info
  port: 8080
  persistence:
    size: 10Gi
    storageClass: ""

litestream:
  enabled: false
  bucket: ""
  endpoint: https://s3.us-east-1.amazonaws.com
  region: us-east-1
  accessKeyIdSecret:
    name: keynv-litestream
    key: access-key-id
  secretAccessKeySecret:
    name: keynv-litestream
    key: secret-access-key

ingress:
  enabled: false
  host: keynv.example.com
  className: nginx
  tls:
    enabled: true
    secretName: keynv-tls
```

## Upgrades

```bash
helm upgrade keynv keynv/keynv -n keynv -f values.yaml
```

The chart pins the appVersion to the keynv release version. Upgrades are zero-downtime within minor versions; major-version migrations may require a brief read-only window (release notes call this out explicitly).
