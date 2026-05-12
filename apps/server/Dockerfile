# Multi-stage Dockerfile for keynv-server.
#
# Stage 1 (builder): installs the full pnpm workspace and produces the
# compiled JS for @keynv/server + its workspace deps.
# Stage 2 (runtime): copies the build output into a minimal Alpine
# image, runs as a non-root `keynv` user, exposes port 8080.
#
# Build context expects to be the repository root (so pnpm-workspace.yaml
# and shared packages are visible). Build with:
#
#   docker build -f apps/server/Dockerfile -t keynv-server:local .

# ---- Stage 1: builder ----
FROM node:20-alpine AS builder

# better-sqlite3 needs a C toolchain; argon2 needs python for node-gyp.
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
COPY packages/rbac/package.json packages/rbac/tsconfig.json ./packages/rbac/
COPY packages/redactor/package.json packages/redactor/tsconfig.json ./packages/redactor/
COPY packages/testers/package.json packages/testers/tsconfig.json ./packages/testers/
COPY apps/server/package.json apps/server/tsconfig.json ./apps/server/

RUN pnpm install --frozen-lockfile --filter '@keynv/server...'

COPY packages/core/src ./packages/core/src
COPY packages/rbac/src ./packages/rbac/src
COPY packages/redactor/src ./packages/redactor/src
COPY packages/testers/src ./packages/testers/src
COPY apps/server/src ./apps/server/src

RUN pnpm --filter @keynv/core build \
  && pnpm --filter @keynv/rbac build \
  && pnpm --filter @keynv/redactor build \
  && pnpm --filter @keynv/testers build \
  && pnpm --filter @keynv/server build

# Trim devDependencies for the runtime stage.
RUN pnpm --filter @keynv/server deploy --prod /out

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runtime

RUN apk add --no-cache libc6-compat tini \
  && addgroup -S keynv \
  && adduser -S keynv -G keynv

WORKDIR /app
COPY --from=builder --chown=keynv:keynv /out/dist ./dist
COPY --from=builder --chown=keynv:keynv /out/node_modules ./node_modules
COPY --from=builder --chown=keynv:keynv /repo/apps/server/src/db/migrations ./dist/db/migrations
COPY --from=builder --chown=keynv:keynv /out/package.json ./package.json

RUN mkdir -p /data && chown keynv:keynv /data

USER keynv
ENV NODE_ENV=production
ENV KEYNV_PORT=8080
ENV KEYNV_DB_PATH=/data/keynv.db
ENV KEYNV_MASTER_KEY_FILE=/data/master.key

EXPOSE 8080
VOLUME ["/data"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
