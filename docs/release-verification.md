# Release Verification

keynv release artifacts are published from `.github/workflows/release.yml`.
Release builds use GitHub OIDC keyless signing through cosign, keep SHA-256
checksums for compatibility, and publish SPDX SBOMs for source and server image
artifacts.

## Artifacts

Every GitHub Release includes:

- `keynv-darwin-arm64`, `keynv-darwin-x64`, `keynv-linux-arm64`,
  `keynv-linux-x64`, and `keynv-windows-x64.exe` CLI binaries.
- `keynv-source.spdx.json` source dependency SBOM.
- `keynv-server-image.spdx.json` server container image SBOM.
- `SHA256SUMS` checksum manifest.
- `*.sig` and `*.pem` files for every binary, SBOM, and `SHA256SUMS`.

The Docker image is published to `ghcr.io/<owner>/keynv-server` and signed by
digest with cosign.

## Verify A CLI Binary

Install cosign first:

```sh
brew install cosign
```

Set release metadata:

```sh
export REPO="keynv-labs/keynv"
export TAG="v0.2.0"
export VERSION="${TAG#v}"
export ARTIFACT="keynv-linux-x64"
export CERT_IDENTITY_RE="https://github.com/${REPO}/.github/workflows/release.yml@refs/(tags/${TAG}|heads/main)"
```

Official releases are normally signed from tag pushes. Manual release dispatches
check out the same tag but use the default branch as the GitHub OIDC workflow
identity, so the verification regex allows both `refs/tags/<tag>` and
`refs/heads/main` for this workflow only.

Download the artifact, its signature, its certificate, and `SHA256SUMS` from the
GitHub Release. Then verify checksum integrity:

```sh
sha256sum --ignore-missing -c SHA256SUMS
```

Verify the keyless signature and GitHub Actions identity:

```sh
cosign verify-blob "${ARTIFACT}" \
  --certificate "${ARTIFACT}.pem" \
  --signature "${ARTIFACT}.sig" \
  --certificate-identity-regexp "${CERT_IDENTITY_RE}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

Verify the checksum manifest itself:

```sh
cosign verify-blob SHA256SUMS \
  --certificate SHA256SUMS.pem \
  --signature SHA256SUMS.sig \
  --certificate-identity-regexp "${CERT_IDENTITY_RE}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

## Verify The Docker Image

Verify the signed image tag:

```sh
cosign verify "ghcr.io/${REPO%/*}/keynv-server:${VERSION}" \
  --certificate-identity-regexp "${CERT_IDENTITY_RE}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

For the strongest check, verify the digest printed in the release workflow logs
or resolved locally:

```sh
docker buildx imagetools inspect "ghcr.io/${REPO%/*}/keynv-server:${VERSION}"
cosign verify "ghcr.io/${REPO%/*}/keynv-server@sha256:<digest>" \
  --certificate-identity-regexp "${CERT_IDENTITY_RE}" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

## Inspect SBOMs

The release publishes SPDX JSON SBOMs. A quick sanity check:

```sh
jq '.spdxVersion, .name' keynv-source.spdx.json
jq '.spdxVersion, .name' keynv-server-image.spdx.json
```

SBOM generation is part of the release workflow. A failed SBOM or signing step
fails the release instead of publishing unsigned artifacts.
