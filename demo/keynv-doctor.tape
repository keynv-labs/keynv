# keynv — the money shot in three glanceable acts:
#   1. doctor finds leaked secrets   2. scrub cleans them   3. doctor: clean
#
# Deterministic + safe: runs against a seeded throwaway sandbox (see
# seed-sandbox.sh), never your real machine, using only fake tokens.
# Each act gets a cleared screen so it reads at a glance.
#
# Record it (from the REPO ROOT):
#   pnpm --filter @keynv/cli build      # build the CLI the demo drives
#   vhs demo/keynv-doctor.tape          # writes demo/keynv-doctor.gif
#
# Needs `vhs` (https://github.com/charmbracelet/vhs) and Node on PATH.

Output demo/keynv-doctor.gif

Require node

Set Shell bash
Set FontSize 18
Set Width 1280
Set Height 700
Set Padding 24
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set TypingSpeed 35ms

# --- hidden setup: seed the sandbox, clear the screen ---
Hide
Type "source demo/seed-sandbox.sh"
Enter
Sleep 1s
Type "clear"
Enter
Sleep 400ms
Show

# --- act 1: find the leaks (‑q drops the noisy per-match previews) ---
Type "keynv doctor -q"
Sleep 500ms
Enter
Sleep 4s

Hide
Type "clear"
Enter
Sleep 300ms
Show

# --- act 2: fix them (atomic, with backups) ---
Type "keynv scrub --yes"
Sleep 500ms
Enter
Sleep 4s

Hide
Type "clear"
Enter
Sleep 300ms
Show

# --- act 3: prove it's clean ---
Type "keynv doctor -q"
Sleep 500ms
Enter
Sleep 3500ms

# --- hidden teardown ---
Hide
Type 'rm -rf "$KEYNV_TS_HOME"'
Enter
Show
