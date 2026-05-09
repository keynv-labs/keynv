---
title: 00 — Vision & Scope
sidebar:
  order: 00
---


## Vision

Developers should be able to use AI coding agents without leaking secrets. Today they can't: every `.env` read, every `git diff`, every `printenv` becomes a vendor-side log entry on Anthropic, OpenAI, or whoever runs the model. **keynv** makes that scenario impossible by design — the AI never sees real values, only aliases. The actual secret is injected into a subprocess the agent's process tree can't observe, and any leaked-looking output is redacted before the agent reads it.

Beyond AI safety, keynv is also a competent secrets manager for small teams: vault, RBAC, audit log, connection testing, and a CLI that doesn't get in the way.

## The problem (concretely)

In 2024, GitHub absorbed 23.7M new hardcoded secrets — a 25% YoY increase. The arrival of always-on AI agents made things worse:

- **Bash tools** run `cat .env`, `env | grep`, `printenv`. Secret values land in the LLM's tool-output context window, and from there in vendor telemetry.
- **File tools** read `.env`, `~/.aws/credentials`, `id_rsa` whenever the agent decides it needs to.
- **VCS tools** show `git diff` / `git log` containing accidentally-committed secrets.
- **Indirect prompt injection** — a malicious README convinces the agent to "use `@prod.db.password` instead of `@dev.db.password`", and the agent obediently exfiltrates production credentials.
- **Supply chain** — rogue MCP servers (e.g., the SANDWORM_MODE class of incidents) hijack agent runtime to steal env vars and OAuth tokens.

Existing secrets managers (Vault, Doppler, Infisical, 1Password, AWS/GCP/Azure Secrets Manager, SOPS) are mature for the human-developer threat model but were not designed for the agent-as-co-pilot threat model. 1Password's `op://` URI scheme is the closest conceptual ancestor: it lets you reference secrets by URI and resolve them only at runtime via `op run`. But there is no end-to-end isolation layer for agent process trees, no agent-aware output redaction, and no per-agent configuration installers.

## Goals

1. **AI agent isolation by default.** The agent's process never has the value in its env/argv/stdin/fd. The agent sees only `@project.env.key` literals.
2. **Agent-agnostic.** Works with Claude Code, OpenCode, Cursor, Codex CLI, Aider — and the next agent shipped tomorrow. Per-agent installers add deeper isolation where the platform supports it.
3. **Small-team friendly.** A 3–15-person team can self-host on one VM in under an hour. No Kubernetes, no Postgres, no separate KMS for the MVP.
4. **Connection testing.** A team lead can verify "this DB credential actually works" without the value ever appearing in their terminal.
5. **RBAC that team leads understand.** Five roles (Owner, Admin, Team Lead, Developer, Reader). Permissions are project-scoped. No policy DSL.
6. **Audit log that holds up.** Append-only, hash-chained, exportable.

## Non-goals (for now)

- **Replacing Vault for enterprise.** No dynamic secrets, no PKI engine, no transit engine. (Phase 6+ may add HSM/KMS integration as a commercial module.)
- **Cloud-hosted SaaS.** keynv is self-host-first. Managed hosting may come later but is not the MVP.
- **Mobile / desktop GUI.** The MVP ships a CLI; web UI arrives in Phase 4.
- **Service mesh / dynamic secret rotation cascade.** Rotating a DB password and updating Kubernetes pods, CI variables, and downstream services automatically is a Phase 6 commercial feature.
- **Browser extension to autofill secrets.** Out of scope.
- **Replacing your password manager.** keynv stores machine secrets — DB credentials, API keys, SSH keys, OAuth client secrets. It's not for personal credentials (use 1Password / Bitwarden for that).

## Target users

| User | Role | Typical workflow |
|---|---|---|
| **Team lead** | Manages a 3–15-person engineering team | Bootstraps the keynv server, creates projects, grants access, monitors audit log, approves prod-secret access |
| **Senior dev** | Day-to-day implementer | Adds new secrets, runs `keynv exec`, occasionally rotates values |
| **Junior dev** | Reads/uses existing secrets | Uses aliases; rarely creates them |
| **AI agent** | Co-pilot | Sees aliases; never sees values; emits redacted output |
| **Auditor / security reviewer** | Periodic compliance work | Reads audit log, verifies hash-chain, exports for SIEM |

The MVP is built primarily for the team lead. They are the buyer, the operator, and the most-impacted user when something goes wrong.

## Success criteria for the MVP (Phase 0–3)

A team lead can:

1. Install keynv on a VM in under 30 minutes (one binary + Litestream sidecar).
2. Create a project, add a Postgres credential, grant read access to two developers.
3. Run `keynv install claude-code` and have a working agent-safe Claude Code session in the same terminal.
4. Watch a developer use Claude Code to query the database via `@project.env.db_password` — and verify in the audit log that the alias was resolved without the value appearing in any tool input/output.
5. Run `keynv test @project.env.db_password` and get OK/FAIL without the value being printed.
6. Rotate the credential and see all access via the alias automatically pick up the new value within 30 seconds.

If those six flows work end-to-end, MVP ships.

## Anti-patterns we explicitly reject

- **"Just add another redaction regex"** — pattern-matching alone is reactive. Prevention (alias-only inputs, privileged subprocess) is the primary defense; redaction is the safety net.
- **"Make the agent run with elevated trust"** — every layer assumes the agent is potentially compromised or prompt-injected. No "trusted agent" path exists.
- **"Encrypt at rest, decrypt in memory, hope nothing escapes"** — every secret must remain encrypted until it reaches the privileged subprocess that needs it.
- **"Use the cloud provider's KMS for everything"** — vendor lock-in. KMS integration is optional and lives behind an interface; the default is local age-encrypted keys in the OS keychain.
- **"Lots of features beats fewer well-tested features"** — the threat model is unforgiving. We'd rather ship four solid layers than ten half-finished ones.

## Why now

- AI coding agents went from novel to mainstream in ~18 months. The threat model is real and shipping in production every day.
- Existing secrets managers haven't been redesigned for this threat model — there's a clear gap.
- Open-source primitives (MCP SDK, Bun's compile-to-binary, Litestream, age) are mature enough that a small team can ship this without building 3 years of infrastructure first.
- Documented incidents (HTTP_PROXY DNS exfil, SANDWORM_MODE, indirect prompt injection in Claude Code / Cursor) show this isn't theoretical.

## How we'll know we're wrong

We're wrong if, after Phase 2 ships, real-world dogfooding shows that:

- Developers don't reach for `keynv exec --` because it's slower than typing `mysql -p$PASS` (target: <100ms overhead end-to-end).
- The redactor has too many false positives in normal output (a `pg_dump` shouldn't get every other column redacted).
- Per-agent installers break on the next agent release because the integration was too tightly coupled.
- The alias syntax is awkward in actual codebases (Bun config files, Dockerfiles, k8s YAML).

If any of those happen, we revise the design before adding more features.
