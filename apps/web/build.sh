#!/bin/sh
set -e
echo "=== NEXT BUILD STARTING ==="
cd /repo/apps/web
pnpm exec next build 2>&1
EXIT=$?
echo "=== NEXT BUILD EXIT CODE: $EXIT ==="
if [ $EXIT -ne 0 ]; then
  echo "=== BUILD FAILED ==="
fi
exit $EXIT
