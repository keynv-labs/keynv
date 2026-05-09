# keynv landing page (static)

Single-file static landing for the temporary public URL while
`keynv.dev` isn't pointed yet. Deployed by `.github/workflows/pages.yml`
on every push to `main`.

This is **not the dashboard** — that's the Next.js app in `apps/web/`.
It's a marketing surface for visitors who land on the public URL
without knowing what keynv is.

## Editing

Just `index.html`. Inline CSS, embedded SVG icons, no build step. Open
the file in a browser to preview locally.

If you change the design tokens upstream (`apps/web/app/globals.css`),
mirror the values in the `<style>` block at the top of `index.html` —
they're duplicated on purpose so this stays a zero-build static site.

## URL

The workflow publishes to GitHub Pages on this repo, which makes the
landing reachable at:

```
https://keynv-labs.github.io/keynv/
```

For the bare org URL `https://keynv-labs.github.io/` (no `/keynv`
suffix) you need a separate repo named `keynv-labs/keynv-labs.github.io`
holding `index.html` at its root. The simplest way to do that is to
copy `apps/landing/` to that other repo's root and let GitHub Pages
serve it from `main` directly.
