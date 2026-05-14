#!/bin/sh
set -e
exec > /tmp/build.log 2>&1
echo "=== NEXT BUILD STARTING ==="
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"
echo "Working directory: $(pwd)"
echo "=== deps ==="
cd /repo/apps/web
pnpm exec next build
echo "=== NEXT BUILD SUCCEEDED ==="
