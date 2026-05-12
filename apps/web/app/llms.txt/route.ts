/**
 * /llms.txt — AI-agent discoverability per https://llmstxt.org/
 *
 * Returns a curated, plain-text summary plus links to deeper docs so
 * crawlers and LLM browsers can pick up the project quickly without
 * scraping the marketing site. Updated when the public surface or
 * docs structure changes.
 */
const SITE = 'https://keynv.dev';
const REPO = 'https://github.com/keynv-labs/keynv';

const BODY = `# keynv

> Self-hosted secrets management built for the AI-coding era. Developers store API keys, DB passwords, and SSH credentials in a vault; reference them everywhere by alias (\`@project.env.key\`); AI coding agents (Claude Code, Cursor, Copilot, etc.) only ever see the alias literal, never the resolved value.

keynv ships three things in one product:

1. A self-hosted vault (SQLite + Litestream, envelope-encrypted with libsodium + age, RBAC, append-only audit chain).
2. An AI-safety layer: a privileged \`keynv exec\` subprocess wrapper, an MCP server that returns single-use refs, and an output redactor (regex + entropy) on every tool result.
3. A tamper-evident audit log: every read, write, rotation, and role change is hash-chained.

The product itself exists because existing vaults (HashiCorp, Doppler, 1Password) were not designed around an AI agent permanently residing in the developer's terminal.

## Quick start

- [Quickstart guide](${SITE}/docs/quickstart): 15-minute self-host on Coolify
- [GitHub repository](${REPO}): source, issues, releases
- [README](${REPO}/blob/main/README.md): positioning, install, first-run
- [Sign up on keynv.dev](${SITE}/register): hosted instance (public beta, no credit card)

## Architecture & docs

- [Architecture overview](${SITE}/docs/architecture): components, data flow, deployment topology
- [Threat model](${SITE}/docs/threat-model): adversary model, mitigations, residual risks
- [Encryption design](${SITE}/docs/encryption-design): KEK/DEK envelope, key rotation, recovery
- [API specification](${SITE}/docs/api): keynv-server HTTP surface (v1)
- [Roadmap](${SITE}/docs/roadmap): phase tracker (Phase 1–3 shipped, Phase 4 in progress)
- [Changelog](${SITE}/changelog): what shipped, when, and why

## Core concepts

- **Alias**: a reference to a secret in the form \`@project.env.key\` — the only string AI agents are ever exposed to.
- **DEK**: per-project Data Encryption Key.
- **KEK**: master Key Encryption Key. Lives in the OS keychain locally; in HSM/KMS in commercial tier.
- **\`keynv exec\`**: privileged subprocess wrapper. Resolves aliases inside a process the AI agent's tree cannot read.
- **Redactor**: pattern + entropy scanner that masks secrets in tool outputs before they reach the AI agent.

## Integrations

- CLI: \`@keynv/cli\` on npm (Node 20+, also distributed as a single-file Bun build)
- MCP server: \`keynv-mcp\` for AI agents that speak Model Context Protocol
- Per-agent setup: run keynv init in your project to migrate .env files and write a .keynv.env (alias references only, safe to commit)

## Project status

Phases 1–3 shipped (vault, CLI, redactor). Phase 4 (web UI, audit chain UX) in progress. Phase 5 (public OSS license, MIT) planned. Phase 6 (commercial tier with Postgres + HSM) on roadmap.

## Contact

- Issues: ${REPO}/issues
- Security: SECURITY.md in the repo (responsible disclosure)
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
