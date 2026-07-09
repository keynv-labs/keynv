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

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
COPY packages/rbac/package.json packages/rbac/tsconfig.json ./packages/rbac/
COPY packages/redactor/package.json packages/redactor/tsconfig.json ./packages/redactor/
COPY packages/testers/package.json packages/testers/tsconfig.json ./packages/testers/
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --filter '@keynv/web...'

# ---- Stage 2: builder ----
FROM node:20-alpine AS builder

WORKDIR /repo
RUN corepack enable

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
# apps/web imports @keynv/core (see apps/web/lib/schemas.ts). pnpm
# symlinked it into node_modules during the deps stage, but webpack
# needs the workspace package's compiled output on disk. Copy the
# source + package metadata and run its build (mirrors what
# apps/server/Dockerfile does).
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
COPY packages/core/src ./packages/core/src
# Re-run install in the builder stage so the symlinked @keynv/core's
# transitive runtime deps (zod, etc.) are present in node_modules at
# build time. The deps stage's --filter web... does not pull those
# workspace-internal deps in, but the apps/server/Dockerfile build
# path somehow ends up with them anyway via its wider copy set. Until
# that asymmetry is resolved at the workspace level, doing a full
# install here is the lowest-risk fix.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile
RUN pnpm --filter @keynv/core build
COPY apps/web ./apps/web

# Static rendering for /changelog and /docs reads these files at
# build time via apps/web/lib/markdown.ts → readFile('CHANGELOG.md')
# and readFile('docs/<page>.md'). The standalone runtime never needs
# them again because content is baked into the prerendered HTML.
COPY CHANGELOG.md ./CHANGELOG.md
COPY docs ./docs

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
# Build-time defaults for env vars that are required at runtime but
# must not cause the build to fail. Real values come from Coolify at
# deploy time; these are only used during `next build`. They can be
# overridden via --build-arg for local docker-compose stacks.
ARG KEYNV_WEB_SESSION_SECRET=build-time-placeholder-not-a-real-secret
ARG KEYNV_SERVER_URL=http://localhost:8080
ENV KEYNV_WEB_SESSION_SECRET=${KEYNV_WEB_SESSION_SECRET}
ENV KEYNV_SERVER_URL=${KEYNV_SERVER_URL}

WORKDIR /repo/apps/web
RUN ./node_modules/.bin/next build

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

USER keynv
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
