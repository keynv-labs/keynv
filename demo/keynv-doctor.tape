# keynv — the money shot: doctor finds leaked secrets, scrub cleans them.
#
# Deterministic + safe: runs against a seeded throwaway sandbox (see
# seed-sandbox.sh), never your real machine, using only fake tokens.
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
Set Width 1120
Set Height 760
Set Padding 26
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set TypingSpeed 40ms

# --- hidden setup: seed the sandbox, clear the screen ---
Hide
Type "source demo/seed-sandbox.sh"
Enter
Sleep 1s
Type "clear"
Enter
Sleep 500ms
Show

# --- 1. find the leaks ---
Type "keynv doctor"
Sleep 600ms
Enter
Sleep 4s

# --- 2. preview the fix ---
Type "keynv scrub --dry-run"
Sleep 600ms
Enter
Sleep 3s

# --- 3. fix it (atomic, with backups) ---
Type "keynv scrub --yes"
Sleep 600ms
Enter
Sleep 3s

# --- 4. prove it's clean ---
Type "keynv doctor"
Sleep 600ms
Enter
Sleep 4s

# --- hidden teardown ---
Hide
Type 'rm -rf "$KEYNV_TS_HOME"'
Enter
Show
