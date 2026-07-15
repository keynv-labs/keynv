# Multi-stage Dockerfile for keynv-web (Next.js 15 dashboard).
#
# Stage 1 (deps):    pnpm install for the @keynv/web filter only.
# Stage 2 (builder): copy sources, run `next build` → .next/standalone.
# Stage 3 (runtime): minimal Alpine + tini + non-root user, runs the
#                    standalone server. The standalone bundle already
#                    embeds the trimmed node_modules subset Next needs.
#
# Build context expects to be the repository root (so pnpm-workspace.yaml
# and shared packages are visible). Build with:
#
#   docker build -f apps/web/Dockerfile -t keynv-web:local .

# ---- Stage 1: deps ----
FROM node:20-alpine AS deps

WORKDIR /repo
RUN corepack enable
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --filter '@keynv/web...'

# ---- Stage 2: builder ----
FROM node:20-alpine AS builder

WORKDIR /repo
RUN corepack enable
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/core/node_modules ./packages/core/node_modules
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages/core ./packages/core

# Static rendering for /changelog and /docs reads these files at
# build time via apps/web/lib/markdown.ts → readFile('CHANGELOG.md')
# and readFile('docs/<page>.md'). The standalone runtime never needs
# them again because content is baked into the prerendered HTML.
COPY CHANGELOG.md ./CHANGELOG.md
COPY docs ./docs

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--dns-result-order=ipv4first --max-old-space-size=4096
# Build-time defaults for env vars that are required at runtime but
# must not cause the build to fail. Real values come from Coolify at
# deploy time; these are only used during `next build`.
ENV KEYNV_WEB_SESSION_SECRET=build-time-placeholder-not-a-real-secret
ENV KEYNV_SERVER_URL=http://localhost:8080

WORKDIR /repo/apps/web
RUN /repo/node_modules/.bin/tsc -p /repo/packages/core/tsconfig.json && ./node_modules/.bin/next build

# ---- Stage 3: runtime ----
FROM node:20-alpine AS runtime

RUN apk add --no-cache tini \
  && addgroup -S keynv \
  && adduser -S keynv -G keynv

WORKDIR /app

# The standalone build is self-contained: server.js + minimal node_modules.
# Static assets are not part of standalone, copy them in alongside.
# (No public/ folder yet; add a COPY for it the day we ship favicons.)
COPY --from=builder --chown=keynv:keynv /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=keynv:keynv /repo/apps/web/.next/static ./apps/web/.next/static
# Next standalone keeps source-root-relative module paths from the workspace
# package, so mirror the dependency tree both inside /app and at the original
# absolute /repo path expected by createRequire(import.meta.url).
COPY --from=builder --chown=keynv:keynv /repo/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder --chown=keynv:keynv /repo/node_modules/.pnpm /repo/node_modules/.pnpm
COPY --from=builder --chown=keynv:keynv /repo/packages/core/node_modules ./node_modules
COPY --from=builder --chown=keynv:keynv /repo/packages/core/node_modules ./apps/web/node_modules
COPY --from=builder --chown=keynv:keynv /repo/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder --chown=keynv:keynv /repo/packages/core/node_modules ./repo/packages/core/node_modules
COPY --from=builder --chown=keynv:keynv /repo/packages/core/node_modules /repo/packages/core/node_modules

# Writable volume mount point for the auto-generated web session secret
# (KEYNV_WEB_SESSION_SECRET_FILE). Owned by the runtime user so a fresh
# named volume inherits writable perms.
RUN mkdir -p /data && chown keynv:keynv /data
VOLUME /data

USER keynv
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
