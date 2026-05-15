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

> Developer-first secrets management for projects, teams, and AI-assisted workflows. Store API keys, database credentials, SSH secrets, webhook tokens, and internal credentials in a vault; reference them everywhere by alias (\`@project.env.key\`); AI coding agents (Claude Code, Cursor, Copilot, etc.) only ever see the alias literal, never the resolved value.

keynv ships three things in one product:

1. A self-hosted vault (SQLite + Litestream, envelope-encrypted with libsodium + age, 5-role RBAC, append-only hash-chained audit log).
2. An AI-safety layer: a privileged \`keynv exec\` subprocess wrapper, an MCP server that returns single-use reference tokens (never the resolved value), and an output redactor (50+ regex patterns + Shannon-entropy fallback) on every tool result.
3. A tamper-evident audit log: every read, write, rotation, approval, and role change is SHA-256 hash-chained and verifiable via \`POST /v1/audit/verify\`.

The product exists because existing workflows still push secrets through .env files, shell history, chat, CI settings, and AI transcripts. keynv gives developers a vault, readable aliases, runtime resolution, and audit logs without changing how they run projects.

## Setting up with an AI agent

Run \`keynv\` in your project root and choose **Set up this project**. keynv writes an \`AGENTS.md\` to your project. All agents that index the repo (Claude Code, Cursor, Windsurf, Aider, Copilot, etc.) pick it up automatically on the next session.

Quick one-liner for any agent chat:

  Install keynv: npm install -g @keynv/cli, then run keynv and choose Set up this project
  After that, always run: keynv exec -- <command>
  Docs: ${SITE}/docs/ai-setup

Full copy-paste prompts for each agent: ${SITE}/docs/ai-setup

## Quick start

- [Set up with your AI agent](${SITE}/docs/ai-setup): copy-paste prompts for Claude Code, Cursor, Aider, and any other agent
- [Quickstart guide](${SITE}/docs/quickstart): 15-minute self-host on Coolify
- [GitHub repository](${REPO}): source, issues, releases
- [README](${REPO}/blob/main/README.md): positioning, install, first-run
- [Sign up on keynv.dev](${SITE}/register): hosted cloud instance (public beta, no credit card)

## Architecture & docs

- [Architecture overview](${SITE}/docs/architecture): components, data flow, deployment topology
- [Threat model](${SITE}/docs/threat-model): adversary model, mitigations, residual risks
- [Encryption design](${SITE}/docs/encryption-design): KEK/DEK envelope, key rotation, recovery
- [API specification](${SITE}/docs/api): keynv-server HTTP surface (v1)
- [Roadmap](${SITE}/docs/roadmap): phase tracker and upcoming milestones
- [Changelog](${SITE}/changelog): what shipped, when, and why

## Core concepts

- **Alias**: a reference to a secret in the form \`@project.env.key\` — the only string AI agents are ever exposed to.
- **DEK**: per-project Data Encryption Key (XSalsa20-Poly1305 via libsodium).
- **KEK**: master Key Encryption Key. Lives in the OS keychain locally; in HSM/KMS in commercial tier.
- **\`keynv exec\`**: privileged subprocess wrapper. Resolves aliases inside a child process the AI agent's tree cannot inherit or read.
- **Redactor**: pattern + entropy scanner that masks secrets in tool outputs before they reach the AI agent.
- **\`keynv\` setup flow**: one-time per-project setup from the TUI. Scans \`.env\` files, uploads secrets to vault, writes \`.keynv.env\` (alias refs only, safe to commit), and writes \`AGENTS.md\` for agent context.

## Integrations

- CLI: \`@keynv/cli\` on npm (Node 20+), compiled binary via \`curl | sh\` or Homebrew
- MCP server: \`keynv-mcp\` — stdio + HTTP transports; \`use_secret(alias)\` returns a single-use ref token, never the value
- Web dashboard: \`/projects/{id}/secrets\`, approval workflows, audit log, connection testers
- Connection testers built-in: Postgres, MySQL, Redis, MongoDB, SSH, HTTP, AWS IAM, GCP SA, Azure SP

## Current version

v0.1.0 — all five phases shipped and publicly available under MIT license.
- Vault, CLI, AI-safety layer, connection testers, web dashboard, and deployment tooling all production-ready.
- Phase 6 (commercial tier: Postgres adapter, SSO/SAML, HSM, keynv Cloud multi-tenant) on roadmap.

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
