# API Compatibility Policy

keynv exposes the human and CLI REST API under `/v1`. The namespace is stable,
but the project is still pre-1.0, so compatibility guarantees are stricter after
`v1.0.0` than they are during release candidates.

## Server Capability Discovery

Clients should read `GET /v1/health` before using newly introduced endpoints.
The response includes the server version, supported API namespace, and feature
flags:

```json
{
  "version": "0.2.0",
  "capabilities": {
    "public_registration": false,
    "api": {
      "current": "v1",
      "supported": ["v1"],
      "stability": "pre-1.0",
      "min_cli_version": "0.1.0-rc.21"
    },
    "features": {
      "batch_secret_create": true,
      "environment_management": true,
      "health_probes": true,
      "prometheus_metrics": true
    }
  }
}
```

Feature flags are additive. A missing flag must be treated as `false` so newer
CLIs can fail with a clear upgrade message against older servers.

## Compatibility Matrix

| Server line | CLI line | Support level | Notes |
|---|---|---|---|
| `0.1.0-rc.x` | same `0.1.0-rc.x` | Supported | Release-candidate APIs may change; use matching RCs for production-like tests. |
| `0.1.0-rc.x` | newer pre-1.0 CLI | Best effort | CLI must check feature flags before using newer endpoints. Missing flags may disable commands. |
| newer pre-1.0 server | older pre-1.0 CLI | Best effort | Existing `/v1` endpoints should keep old behavior when practical. New server-only features are invisible to old CLIs. |
| `1.x` server | `1.x` CLI within one minor | Supported | After `v1.0.0`, one-minor CLI/server skew is supported unless release notes say otherwise. |
| `1.x` server | older than one minor behind | Deprecated | May work, but operators should upgrade before requesting support. |

## Pre-1.0 Rules

- `/v1` remains the only REST namespace, but individual endpoints and fields may
  change during release candidates when needed to reach the production baseline.
- Breaking pre-1.0 changes must be called out in release notes.
- New CLI code must check `capabilities.features` before using endpoints added
  after the initial release candidate when practical.
- Server responses may add fields at any time. Clients must ignore unknown
  fields.

## Post-1.0 Rules

- Additive changes to `/v1` are allowed: new fields, endpoints, feature flags,
  enum values documented as extensible, and optional request fields.
- Breaking changes require a new namespace such as `/v2`, or a compatibility shim
  in `/v1` for at least one minor release.
- Deprecated `/v1` behavior receives at least 90 days notice before removal.
- Release notes must include migration guidance and the first version that emits
  deprecation warnings.

## MCP Compatibility

MCP tools use name-based versioning for breaking changes, for example
`keynv.use_secret_v2`. Existing tool semantics must not change silently.
