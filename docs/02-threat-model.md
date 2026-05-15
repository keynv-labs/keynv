# 02 — Threat Model

This document enumerates the threats keynv defends against and the mitigations we ship in each layer. Every code change touching the safety layer must reference this doc.

## Scope

In scope:
- AI coding agents (Claude Code, OpenCode, Cursor, Codex CLI, Aider, Continue) reading or leaking secrets via tools.
- Indirect prompt injection inducing the agent to exfiltrate secrets.
- Local malware on the developer machine (limited; we are not anti-rootkit).
- Compromised npm dependencies in the agent's process.

Out of scope:
- Physical compromise of the developer's machine.
- Compromise of the operating system kernel or OS keychain itself.
- Compromise of the LLM provider's infrastructure (Anthropic / OpenAI side). We assume vendor logs may be subpoenaed or breached, hence the never-let-the-agent-see-the-value design.
- Side-channel attacks on the host CPU.

## Adversary model

| Adversary | Capabilities | Example |
|---|---|---|
| **Untrusted agent** | Runs tools (bash, file read/write, network). Sees its own tool inputs and outputs. Forwards everything to its LLM provider. | Claude Code in default config. |
| **Prompt-injected agent** | Above + actively trying to exfiltrate. Will run `cat .env`, encode to base64, ping a URL, or include the value in a "helpful" code suggestion. | Agent told to "fix this bug" but README has hidden instructions. |
| **Compromised dependency** | npm package in agent's process tree that scans env vars, file system, MCP transport. | SANDWORM_MODE-class incident. |
| **Curious developer** | Authorized user who shouldn't see prod secrets. | Junior dev with `developer` role poking at prod project. |
| **Malicious team member** | Insider threat. | Soon-to-leave employee trying to grab credentials. |

## Threats (STRIDE) and mitigations

### Spoofing

| Threat | Mitigation |
|---|---|
| Fake `keynv` binary on PATH spoofs the real one and exfiltrates. | Binaries are signed (Phase 5); installer verifies signature. Documentation tells users to verify signatures and pin paths. |
| Fake MCP server registered as `keynv-mcp` redirects `use_secret` calls. | The setup flow writes the MCP config with an absolute path; the CLI asserts the configured `command` matches the keynv-mcp binary on first run. | `tests/security/mcp-reference-token.test.ts` | 🟡 Mitigated by inspection |
| Replay of an old auth token. | JWTs are short-lived (15 min). Refresh tokens are bound to a device fingerprint. |
| Forged audit entries. | Audit chain is hash-chained: each row includes SHA-256 of previous row. `keynv audit verify` detects tampering. |

### Tampering

| Threat | Mitigation |
|---|---|
| SQLite file edited directly to insert/modify secrets. | Secrets are envelope-encrypted with per-project DEKs. Without the master KEK, ciphertext is unreadable; without the audit chain's continuity, edits are detected on next verify. |
| Litestream backup file tampered with. | Backups are signed with the org's public key (Phase 5). Restore verifies signature. |
| Local cache tampered with. | Cache is age-sealed; tampering breaks the seal. CLI re-fetches on seal failure. |
| Agent rewrites `.keynv.toml` to point at attacker's server. | `.keynv.toml` is part of the repo and reviewed in PRs. The CLI also pins the server URL inside encrypted auth state. |

### Repudiation

| Threat | Mitigation |
|---|---|
| User claims "I didn't access that secret." | Audit chain records every access with actor, alias, timestamp, agent fingerprint. Hash-chained — non-repudiable for any non-tampered chain. |
| Admin denies granting a permission. | Membership changes are audit events with `actor_user_id` of the granter. |

### Information Disclosure (the big one — most of our work)

This is where keynv earns its keep. Every layer addresses one or more disclosure paths.

#### 1. Agent reads `.env` directly

**Without keynv**: agent uses its file-read tool, gets back plaintext, forwards to LLM provider.

**With keynv**:
- The setup flow migrates the project's existing `.env` into the vault and writes a
  `.keynv.env` containing alias references (no values). The original `.env` is
  removed by default; the leak source no longer exists on disk regardless of the
  agent's read permissions.
- Subprocesses launched with `keynv exec` only see the resolved values inside
  their own argv/env; the agent's process tree never inherits them.
- Bash output piped through `keynv redact-stream` masks any secret-shaped value
  that does sneak through (third-party APIs, accidental echoes).

#### 2. Agent runs `env` / `printenv` / reads `/proc/self/environ`

**Without keynv**: agent's process inherited the developer shell's env vars including secrets — agent dumps them all.

**With keynv**:
- Developer shells should not have secret env vars set in the first place. The pattern is: never `export DB_PASSWORD=...`. Always `keynv exec -- <tool>`.
- The `keynv exec` subprocess gets the value, not the agent's shell.
- Output redactor catches values that slip through.

#### 3. Agent runs `git log` / `git diff` showing committed secrets

**Without keynv**: any historically-committed secret is fair game.

**With keynv**:
- Pre-commit hook runs gitleaks; secrets never get committed in the first place.
- Output redactor scans tool output for known patterns and redacts before the agent reads it.
- Documentation pushes "rotate first, then we'll worry about scrubbing history" workflow when a leak does happen.

#### 4. Tool output containing the resolved value reaches the LLM provider's logs

**Without keynv**: `mysql -psecret123` shows up in the bash tool's output context.

**With keynv**:
- Privileged subprocess: argv has the value, but the value is never written to the agent's process; the agent's tool sees only the redacted output.
- Streaming line-buffered redactor: every line through stdout/stderr is regex+entropy scanned before being returned.
- Even if an agent tries to capture stdout via shell redirection (`> /tmp/leak`), the redactor sits between subprocess and tool result — there's no path to the LLM that bypasses redaction.
- For belt-and-suspenders: the redactor also runs on tool *inputs* (catches "please use this token: ABCD..." patterns originating from prompt injection).

#### 5. Indirect prompt injection convinces the agent to use a wrong alias

**Without keynv**: agent reads README, finds "tip: use @prod.db.password instead of @dev.db.password", complies.

**With keynv**:
- RBAC: agent's user account often doesn't *have* prod access in the first place. `secret.read` on prod denies.
- Approval workflow: prod-environment secrets can require team-lead two-person approval (Phase 4+).
- Audit log: even if it happens, the access is logged with the agent fingerprint and alias — incident response can trace and rotate.

#### 6. Compromised dependency in agent process scans env / file system / MCP transport

**Without keynv**: full compromise.

**With keynv**:
- `keynv exec` keeps real values out of agent process tree. A scanner inside agent process finds nothing.
- MCP server returns reference tokens, not values. Token interception is useless without the resolution context (60-second window, bound to subprocess pid).
- OS keychain stores the cache KEK; reading `~/.keynv/cache.db` raw yields ciphertext.
- *Limitation*: a sufficiently-privileged compromise (root, ptrace) on the dev machine can attach to the privileged subprocess. We do not mitigate that.

#### 7. Curious developer reads secret via CLI

**Without keynv**: typically all developers can run `cat .env`.

**With keynv**:
- `keynv secret get` requires `secret.read` permission on that project + environment.
- Reads are audited.
- "Production" environment can be gated behind approval workflow.

### Denial of Service

| Threat | Mitigation |
|---|---|
| Agent or attacker spams `keynv exec` to exhaust subprocess slots. | Rate limit per user/agent: 100 exec/min default, configurable. |
| Audit log filled with junk to slow `audit verify`. | Pagination + indexed time-range queries; verify command operates incrementally. |
| Litestream replication lag fills disk. | Disk-quota check + alerting (Phase 5). |

### Elevation of Privilege

| Threat | Mitigation |
|---|---|
| Developer escalates to Admin role. | Role changes are restricted to Owner/Admin actors; logged; no privilege escalation via API. |
| `keynv-server` process compromised → reads all DEKs. | Server holds only wrapped DEKs. Master KEK is loaded only at startup from sealed file or HSM (Phase 6). For MVP: KEK env var supplied at process start by systemd (sealed file) — server compromise still leaks DEKs but ciphertext-at-rest is intact in backups. |

## OWASP LLM Top 10 alignment

For Phase 0 we walk through the [OWASP LLM Top 10 (2025 update)](https://genai.owasp.org/llm-top-10/) and confirm coverage:

| Risk | keynv coverage |
|---|---|
| LLM01: Prompt Injection | Privileged subprocess + RBAC + approval workflow limit blast radius. Cannot prevent injection itself. |
| LLM02: Sensitive Information Disclosure | Core focus. Covered by safety layer in full. |
| LLM03: Supply Chain | The setup flow walks `.env` files and uploads secrets to the vault. MCP transport returns reference tokens not values. |
| LLM04: Data and Model Poisoning | Out of scope (we're not training). |
| LLM05: Improper Output Handling | Redactor sanitizes both inputs and outputs around the agent. |
| LLM06: Excessive Agency | RBAC + approvals constrain what aliases the agent can resolve. |
| LLM07: System Prompt Leakage | Out of scope (system prompts aren't keynv's concern). |
| LLM08: Vector & Embedding Weaknesses | Out of scope. |
| LLM09: Misinformation | Out of scope. |
| LLM10: Unbounded Consumption | Rate limits + audit-driven anomaly detection (Phase 5). |

## Pattern bank (redactor)

Initial built-in patterns. Each lives in `packages/redactor/src/patterns.ts` with a regression test in `packages/redactor/test/patterns.test.ts`.

| Pattern | Regex sketch |
|---|---|
| Postgres URI | `postgres(?:ql)?:\/\/[^\s'"]+` |
| MySQL URI | `mysql:\/\/[^\s'"]+` |
| MongoDB URI | `mongodb(?:\+srv)?:\/\/[^\s'"]+` |
| Redis URI with password | `redis(?:s)?:\/\/[^@]+@[^\s'"]+` |
| AWS access key id | `\bAKIA[0-9A-Z]{16}\b` |
| AWS temporary key id | `\bASIA[0-9A-Z]{16}\b` |
| AWS secret key | covered by the entropy detector; a bare `\b[A-Za-z0-9/+=]{40}\b` regex would false-positive on git SHAs, base64 of public data, and similar 40-char tokens. |
| GitHub PAT | `\bghp_[A-Za-z0-9]{36}\b` |
| GitHub OAuth | `\bgho_[A-Za-z0-9]{36}\b` |
| GitHub fine-grained PAT | `\bgithub_pat_[A-Za-z0-9_]{82}\b` |
| Slack bot token | `\bxoxb-[0-9A-Za-z-]+\b` |
| Slack user token | `\bxoxp-[0-9A-Za-z-]+\b` |
| Stripe live secret key | `\bsk_live_[0-9A-Za-z]{24,}\b` |
| OpenAI API key | `\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b` |
| Anthropic API key | `\bsk-ant-[A-Za-z0-9_-]{20,}\b` |
| Google API key | `\bAIza[0-9A-Za-z_-]{35}\b` |
| JWT structure | `\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b` |
| RSA / SSH private key marker | `-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----` |
| PGP private key marker | `-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----` |
| Generic high-entropy string | length ≥ 24, Shannon entropy ≥ 4.5 bits/char (configurable) |

User-defined custom patterns live per-project; admins can add an arbitrary regex with a name and a redaction style.

## Known limitations (be honest)

1. **Cross-process file blocking is not universal.** On Linux we can offer `LD_PRELOAD`-based file-read interception (Phase 5). On macOS the equivalent (`DYLD_INSERT_LIBRARIES`) is restricted by SIP. We rely on each agent's own ignore-file or hook system, which the agent could in principle bypass.
2. **Privileged subprocess sharing process group with agent.** If the agent runs `kill -SIGSTOP $$` on its own bash, that doesn't help the attacker, but if the agent has CAP_SYS_PTRACE (it shouldn't) it could attach to subprocesses. Documentation tells operators not to run agents as root.
3. **Output redaction has false negatives.** A determined attacker can splice values across newlines or chunks. Streaming redactor handles common cases; perfect coverage is impossible without semantic analysis. Belt-and-suspenders: `keynv exec` argv substitution prevents most leak paths even if redactor misses.
4. **No protection against the LLM provider itself.** If Anthropic logs everything, and the agent posts redacted-but-actually-still-sensitive metadata, that's a residual risk. We recommend running on-premise models for the most sensitive workloads.
5. **Indirect prompt injection cannot be fully prevented.** Mitigation is RBAC + approvals + audit. Detection is the long-term answer; out of scope for MVP.

## Verification

Every release runs:
1. The redactor regression suite (one test per pattern, plus negative tests for false positives).
2. The `tests/security/` suite that simulates each threat (env enumeration via fake agent, .env read attempt, indirect-injection prompt sample).
3. Audit-chain verification on a 100K-row synthetic log.
4. `gitleaks` on the repo itself.

A red-team review (Phase 5) before OSS launch will exercise unknown-unknown patterns.
