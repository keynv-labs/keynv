# keynv landing page (static)

Single-file static landing for the temporary public URL while
`keynv.dev` isn't pointed yet. Live at:

> **<https://keynv-labs.github.io/>**

This is **not the dashboard** — that's the Next.js app in `apps/web/`.
It's a marketing surface for visitors who land on the public URL
without knowing what keynv is.

## Editing

Just `index.html`. Inline CSS, embedded SVG icons, no build step. Open
the file in a browser to preview locally.

If you change the design tokens upstream (`apps/web/app/globals.css`),
mirror the values in the `<style>` block at the top of `index.html` —
they're duplicated on purpose so this stays a zero-build static site.

## Publishing

The live site is served from a separate repo:
[`keynv-labs/keynv-labs.github.io`](https://github.com/keynv-labs/keynv-labs.github.io).
GitHub auto-activates Pages for that exact repo name and serves it at
the bare org URL.

To roll out a change:

```bash
# from the keynv repo root, after editing apps/landing/index.html
cp apps/landing/index.html /tmp/keynv-orgpage/index.html  # or wherever you cloned it
cp apps/landing/icon.svg   /tmp/keynv-orgpage/icon.svg
cd /tmp/keynv-orgpage
git add -A && git commit -m "update landing" && git push
```

Pages re-deploys within ~60 seconds.

When `keynv.dev` is ready, retire this URL by setting a CNAME on the
org-page repo (or just stop pointing people at `keynv-labs.github.io`).
