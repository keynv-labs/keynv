# demo/

Assets for the README hero and social sharing. Everything here is
reproducible and touches **only a throwaway sandbox** — no real secrets,
no real surfaces.

## `keynv-doctor.tape` → `keynv-doctor.gif`

The hero recording: `keynv doctor` finds leaked secrets → `keynv scrub`
cleans them → `keynv doctor` proves it's clean.

It runs against a seeded sandbox (`seed-sandbox.sh`) via the `KEYNV_TS_HOME`
override, so recording it never reads or writes anything real.

### Regenerate

From the **repo root**:

```bash
# 1. build the CLI the demo drives
pnpm --filter @keynv/cli build

# 2. install vhs once: https://github.com/charmbracelet/vhs
#    macOS:  brew install vhs
# 3. record
vhs demo/keynv-doctor.tape        # writes demo/keynv-doctor.gif
```

Commit the regenerated `keynv-doctor.gif` alongside any tape change. The
root `README.md` references it at `./demo/keynv-doctor.gif`.

### Try the sandbox by hand

```bash
pnpm --filter @keynv/cli build
source demo/seed-sandbox.sh
keynv doctor            # scans the fake sandbox, not your machine
keynv scrub --dry-run
rm -rf "$KEYNV_TS_HOME"  # clean up
```

## `og-image.svg` → GitHub social preview

1280×640 Open Graph card for **Settings → General → Social preview** (and
any link share of the repo). Render to PNG before uploading (GitHub's
social-preview upload wants a raster image):

```bash
# any one of these
rsvg-convert -w 1280 -h 640 demo/og-image.svg -o demo/og-image.png
# or: npx @resvg/resvg-js-cli demo/og-image.svg demo/og-image.png
# or: open demo/og-image.svg in a browser and screenshot at 1280×640
```
