# Disabled workflows

These workflows are paused while the project is in personal/team-internal use. They
are kept here (rather than deleted) so they can be restored verbatim when keynv is
ready for a public OSS launch.

GitHub Actions only runs files inside `.github/workflows/`, so the rename to
`.github/workflows.disabled/` is enough to stop them; no further config needed.

## What each one does (and when to bring it back)

| File | Purpose | Bring back when |
|---|---|---|
| `ci.yml` | Lint + typecheck + test on every PR | A second contributor joins, or you start opening PRs against yourself for review |
| `docs.yml` | Build Astro docs and deploy to GitHub Pages | The docs site goes public |
| `security.yml` | Nightly `pnpm audit` + CodeQL | Pre-release hardening, or you want a dependency-vuln watchdog |
| `release.yml` | Tag-driven Bun-compiled CLI binaries (5 platforms, cosign-signed) + multi-arch Docker push to ghcr.io + Helm chart push | You want to distribute the CLI as a downloadable for end users, OR run on Kubernetes |

## Restore one workflow

```bash
mkdir -p .github/workflows
git mv .github/workflows.disabled/ci.yml .github/workflows/ci.yml
```

## Restore all

```bash
mkdir -p .github/workflows
git mv .github/workflows.disabled/*.yml .github/workflows/
rmdir .github/workflows.disabled
```

## Why disabled?

The deployment target is **Coolify** (self-hosted PaaS). Coolify pulls the repo and
builds the Docker image itself, so none of these workflows are load-bearing for the
actual deploy path. They are pure OSS-launch infrastructure (signed releases, public
docs site, vuln scanning) that becomes valuable later, not now.

See `deploy/COOLIFY.md` for the actual deploy flow.
