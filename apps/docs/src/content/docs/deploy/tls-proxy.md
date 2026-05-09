---
title: Behind a TLS proxy
description: keynv-server doesn't terminate TLS itself; pair it with Caddy, nginx, or Traefik.
sidebar:
  order: 3
---

## Why no built-in TLS?

keynv-server is a plain HTTP/1.1 server. Every production deployment we've seen wants:

- An automatically-renewed cert (Let's Encrypt).
- Independent log/access-log infrastructure.
- A single TLS termination point for many internal services.

Forcing keynv to manage certs in-process duplicates work that Caddy / nginx / Traefik / cloud load balancers do better. Run keynv on `localhost:8080` (or in a private network) and proxy.

## Caddy

Drop in [`deploy/caddy.example.Caddyfile`](https://github.com/keynv-labs/keynv/blob/main/deploy/caddy.example.Caddyfile). Replace the hostname:

```Caddyfile
keynv.your-domain.com {
    encode gzip
    reverse_proxy localhost:8080 {
        transport http {
            read_timeout 60s
            write_timeout 60s
        }
    }
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
    log {
        output file /var/log/caddy/keynv.log
        format json
    }
}
```

Caddy auto-renews the cert.

## nginx

```nginx
server {
    listen 443 ssl http2;
    server_name keynv.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/keynv.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/keynv.your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
```

## Cloudflare / load balancer in front

If your TLS terminates at a CDN edge (Cloudflare, Cloud LB, etc.), make sure:

1. The connection from the edge to your origin is encrypted (Full / Strict in Cloudflare).
2. You set `KEYNV_SERVER_URL` (CLI, web) and audit-trail tooling to the public HTTPS URL, not the origin.
3. `X-Forwarded-Proto: https` is set so the server's session-cookie `Secure` flag works correctly.

## CLI / web URLs

```bash
# CLI: persisted in ~/.keynv/credentials.enc when you log in
keynv login --server https://keynv.your-domain.com --email …

# Web: env var at deploy time
KEYNV_SERVER_URL=https://keynv.your-domain.com pnpm --filter @keynv/web start
```
