# What keynv is

> **Runtime text-surface protection for AI coding workflows.**

This is a category, not a metaphor. The text we work with — terminal
output, shell history, AI agent transcripts, IDE logs — is now the
primary leak surface for secrets. keynv is the layer that keeps secrets
out of those surfaces while developers and agents continue to work the
way they already do.

---

## The shift

Until recently, secret leakage was a *storage* problem: pushed to git,
copied to Slack, left in a `.env` you forgot to gitignore. The mature
answer — Vault, Doppler, Infisical, 1Password — solved storage. They
won that round.

AI coding agents broke the assumption underneath. Now every command,
every file open, every pasted stack trace, every `cat .env` lands inside
an AI agent's session transcript on disk. Shell history captures the
same. Terminal recorders, screenshots, copy-paste into a chat — the
*text* a developer touches throughout a day is the leak channel, and
nobody is watching it.

The data we collected on a single developer machine in May 2026:

- **62,000+ likely-secret signals** across Claude Code transcripts and
  shell histories on a working machine
- **~900 of those** matched specific vendor patterns: AWS keys, GitHub
  PATs, JWT tokens, Stripe keys, postgres connection URIs
- The rest were high-entropy strings that *might* be secrets — common
  shape, common origins

That's one machine. The same machine would have been considered
"compliant" by any storage-era secret-manager audit.

---

## What we're not

These categories already have mature incumbents. keynv does not compete
with them and never will:

- ❌ Vault alternative
- ❌ Doppler / Infisical / 1Password alternative
- ❌ ".env replacement"
- ❌ "Secrets manager"
- ❌ Enterprise SSO / SCIM / federation layer
- ❌ Compliance theatre

If your problem is "where do I store the secret," those tools solved it
already. keynv plugs into them (or to its own local vault) the same way.
Storage is an implementation detail.

---

## The thesis

Two primitives, one job.

### 1. Alias-first resolution

Developers and agents reference `@prod.database.url`. The runtime
resolves the alias to the real value ephemerally — inside a privileged
subprocess that the agent's process tree cannot read. Output through
the redactor. Audit trail per resolution event.

This is the "the secret was used but the agent never saw it" half.

### 2. Surface scrubbing

Every text surface where a secret could leak — terminal stdout, shell
history files, Claude Code session JSONL, Cursor logs, CI output, pasted
stack traces — is monitored, scrubbed, or pre-empted.

- `keynv doctor` — counts the leaks you already have.
- `keynv scrub` — atomically rewrites them.
- `keynv shell install` — preventive history hook.
- `keynv watch` — real-time scrubber for live transcripts.

This is the "the surfaces themselves stop being leak vectors" half.

The two halves compose. The alias half catches secrets before they
enter a surface. The scrubbing half catches the ones that slip through
(`cat .env`, an error message that prints a URL, a stack trace that
echoes a header).

---

## How we judge success

A keynv install is working when:

1. `keynv doctor` reports zero likely leaks on a developer's machine.
2. `keynv watch` is running, and the audit log shows steady scrubs of
   live AI agent sessions.
3. A developer using AI agents experiences *less stress*, not more
   process. The right reaction is "wait, my agent can use prod secrets
   safely now?" — not "ugh, another tool."

Security alone does not win. Workflow relief wins.

---

## Trust is the product

keynv runs entirely on the developer's machine for the OSS path. No
network calls leave the host without explicit opt-in. The threat model
([docs/02-threat-model.md](./02-threat-model.md)) is honest about what
keynv does *not* defend against — compromised kernels, memory scrapers,
malicious binaries the developer themselves ran. Trust is the product;
overclaiming destroys it.

The local-first posture is a deliberate choice. Self-host is the
default and only way for the OSS phase. A managed Cloud option may exist
later as a commercial deliverable; the architecture is the same.

---

## Where this goes

Phase A — *runtime primitives* — is shipping now:

| Primitive | Status |
|---|---|
| `keynv doctor` retro scan | done |
| `keynv scrub` atomic rewrite | done |
| `keynv shell install` preventive hook | done |
| `keynv watch` real-time daemon | done |
| Fingerprint registry from `keynv exec` resolution | done |
| Docs + threat model + vision | done (this doc) |

Phase B — *MCP capability tokens + agent-bound execution* — is next:

- A new `keynv.run` MCP tool: the agent calls it, the runtime resolves,
  executes the subprocess, pipes output through the redactor, and
  returns *redacted* stdout/stderr. The secret value never enters the
  MCP response.
- Capability-scoped tokens (`@stripe.*` vs `@aws.*`) bound to MCP
  session ID.
- AGENTS.md upgrades to a per-project capability contract.

Phase C — *first-class agent integrations* — comes after that:

- Claude Code skill.
- Cursor extension.
- CI patterns docs.

Sandboxing, network-egress restriction, seccomp profiles, enterprise
RBAC layers — explicitly *not* on the roadmap. Narrative dilution risk
is real; we are not building a general secure execution platform.

---

## How to use this document

When in doubt about whether a feature belongs in keynv: does it make
*text surfaces* safer for AI coding workflows? If yes, in scope. If it
makes *secret storage* fancier, out of scope (the incumbents already
won). If it makes *agents themselves* run in sandboxes, out of scope
(different category, different product).
