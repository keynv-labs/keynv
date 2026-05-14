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
COPY apps/web ./apps/web

# Static rendering for /changelog and /docs reads these files at
# build time via apps/web/lib/markdown.ts → readFile('CHANGELOG.md')
# and readFile('docs/<page>.md'). The standalone runtime never needs
# them again because content is baked into the prerendered HTML.
COPY CHANGELOG.md ./CHANGELOG.md
COPY docs ./docs

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096

WORKDIR /repo/apps/web
RUN node --version && pnpm --version && ls -la node_modules/.bin/next

# DEBUG: build her zaman exit 0 ile biter; çıktı /repo/build-output.log'a yazılır
# ve runtime CMD bunu container logs'a dump eder. Coolify build raw output
# göstermediği için tek görünürlük kanalı bu. Build başarılıysa server normal
# başlar; başarısızsa dummy standalone oluşturulur ve container idle kalır.
RUN set +e; \
    ./node_modules/.bin/next build > /repo/build-output.log 2>&1; \
    BUILD_EXIT=$?; \
    echo $BUILD_EXIT > /repo/build-exit-code; \
    if [ "$BUILD_EXIT" -ne 0 ]; then \
      mkdir -p /repo/apps/web/.next/standalone/apps/web /repo/apps/web/.next/static; \
      echo "console.log('build failed — see /app/build-output.log');" > /repo/apps/web/.next/standalone/apps/web/server.js; \
    fi; \
    exit 0

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

# DEBUG: build log + exit code, debug katmanı için.
COPY --from=builder --chown=keynv:keynv /repo/build-output.log /app/build-output.log
COPY --from=builder --chown=keynv:keynv /repo/build-exit-code /app/build-exit-code

USER keynv
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
# DEBUG CMD: önce build çıktısını dump et; build başarılıysa server'ı başlat,
# başarısızsa container idle kalsın ki Coolify container logs gerçek next
# build hatasını gösterebilsin.
CMD ["/bin/sh", "-c", "echo '===== BUILD OUTPUT (next build stdout+stderr) ====='; cat /app/build-output.log; echo '===== BUILD EXIT CODE ====='; cat /app/build-exit-code; echo '===== END DEBUG ====='; if [ \"$(cat /app/build-exit-code)\" = \"0\" ]; then echo '>>> next build succeeded — starting server'; exec node apps/web/server.js; else echo '>>> next build FAILED — container idling so logs stay readable (sleep 24h)'; sleep 86400; fi"]
