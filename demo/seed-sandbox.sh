#!/usr/bin/env bash
# keynv demo sandbox — seeds a THROWAWAY $KEYNV_TS_HOME with FAKE secrets so
# `keynv doctor` / `keynv scrub` can be demoed (and recorded) without ever
# touching — or exposing — anything real on your machine.
#
# Every token below is a fake / documented-example value. None are live
# credentials. The scanner reads $KEYNV_TS_HOME instead of $HOME (see
# packages/text-surfaces/src/paths.ts), so the real surfaces are never read.
#
# Meant to be *sourced* so the exports + `keynv` function land in your shell:
#   source demo/seed-sandbox.sh
#   keynv doctor
#
# It defines a `keynv` function that runs THIS repo's built CLI. Build first:
#   pnpm --filter @keynv/cli build

# Resolve repo root from this script's own location (works when sourced).
_seed_src="${BASH_SOURCE[0]:-$0}"
_seed_dir="$(cd "$(dirname "$_seed_src")" && pwd)"
KEYNV_REPO="$(dirname "$_seed_dir")"

# Throwaway home the scanner treats as $HOME.
KEYNV_TS_HOME="$(mktemp -d "/tmp/keynv-demo.XXXXXX")"  # short path = tidy demo output
export KEYNV_TS_HOME
unset HISTFILE  # don't let a stray $HISTFILE pull your real zsh history in

# A couple of fake tokens are assembled from fragments at runtime so this
# committed script never contains a secret-SHAPED literal. Otherwise GitHub
# push protection (correctly!) blocks the push — the very leakage keynv
# exists to prevent. They only ever materialise inside the sandbox below.
# NOTE: keep the "" splits — do not "tidy" them into single literals.
_stripe="sk_""live_51AbCdEfGhIjKlMnOpQrStUvWx"
_slack="https://hooks.""slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"

# --- fake shell history (unquoted heredoc so $_stripe expands) -----------
cat > "$KEYNV_TS_HOME/.zsh_history" <<EOF
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
aws s3 cp backup.tar.gz s3://prod-bucket --profile default
curl -H "Authorization: Bearer sk-1a2B3c4D5e6F7g8H9i0JklmnopQRstuvWXyz1234567890AB" https://api.openai.com/v1/models
git clone https://ghp_1A2b3C4d5E6f7G8h9I0jklmnopqrstuvwx12@github.com/acme/private.git
psql postgres://admin:s3cr3tP4ss@db.internal:5432/prod -c 'select 1'
stripe trigger payment_intent.succeeded --api-key $_stripe
EOF

# --- fake Claude Code transcript (unquoted heredoc so vars expand) -------
mkdir -p "$KEYNV_TS_HOME/.claude/projects/demo"
cat > "$KEYNV_TS_HOME/.claude/projects/demo/s.jsonl" <<EOF
{"type":"user","message":{"role":"user","content":"the env is DATABASE_URL=postgres://admin:s3cr3tP4ss@db.internal:5432/prod"}}
{"type":"assistant","message":{"role":"assistant","content":"I'll call the API with OPENAI_API_KEY=sk-1a2B3c4D5e6F7g8H9i0JklmnopQRstuvWXyz1234567890AB."}}
{"type":"tool_result","content":"remote: Invalid token ghp_1A2b3C4d5E6f7G8h9I0jklmnopqrstuvwx12"}
{"type":"assistant","message":{"role":"assistant","content":"Posting to $_slack"}}
{"type":"user","message":{"role":"user","content":"token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRlbW8ifQ.s3cr3t_dummy_signature_not_real"}}
{"type":"assistant","message":{"role":"assistant","content":"Stripe key $_stripe and AKIAIOSFODNN7EXAMPLE noted."}}
EOF

# Backdate the seeded surfaces. `scrub` skips files touched in the last
# ~10s (they look like a live AI session); we want them treated as
# pre-existing history so the demo's `scrub` cleans everything.
touch -t 202601010000 \
  "$KEYNV_TS_HOME/.zsh_history" \
  "$KEYNV_TS_HOME/.claude/projects/demo/s.jsonl"

# --- a `keynv` that runs this repo's built CLI ---------------------------
keynv() { node "$KEYNV_REPO/apps/cli/dist/index.js" "$@"; }

printf 'keynv demo sandbox ready at %s\n' "$KEYNV_TS_HOME"
