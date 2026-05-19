# keynv

> Runtime text-surface protection for AI coding workflows.

Your AI agent's transcripts, your shell history, and your terminal
output are leaking secrets right now. keynv keeps them out, in real
time, on your machine. No cloud. No re-architecting how you work.

```text
$ keynv doctor

  !  zsh history                 5 likely secrets across 1 file
  !  Claude Code transcripts     62,306 likely secrets across 73 files
  ·  Cursor logs                 clean

  Total: 62,311 likely secrets across 74 files.

  Top patterns:
    aws-access-key-id       90
    openai-api-key          81
    github-pat-classic      59
    jwt                     59
    slack-webhook           45
    stripe-live-secret-key  34
    postgres-uri            515
    ...
```

That's one developer machine on a normal workday. Vendor-prefixed token
leaks are common, postgres URIs with credentials are extremely common,
and almost every AI agent session has at least one. The same machine
would pass any storage-era secret-manager audit clean.

keynv finds the leaks. Then it fixes them — atomically, with backups —
and stops new ones happening.

```bash
keynv scrub               # retroactively clean what doctor found
keynv shell install       # prevent new leaks from landing in shell history
keynv watch start         # scrub live AI agent sessions in real time
keynv exec -- npm run dev # agents reference aliases; real values stay in a subprocess they can't see
```

See [`docs/00-vision.md`](./docs/00-vision.md) for the long form;
[`docs/02-threat-model.md`](./docs/02-threat-model.md) for what keynv
defends against and what it explicitly doesn't.

---

## What keynv is not

These categories already have mature incumbents. keynv does not compete
with them:

- ❌ Vault / Doppler / Infisical / 1Password alternative
- ❌ ".env replacement"
- ❌ Secrets manager
- ❌ Enterprise SSO / SCIM / federation
- ❌ Compliance theatre

If your problem is "where do I store the secret," those tools solved
that already. keynv plugs in next to them (or to its own local SQLite
vault). Storage is an implementation detail. Runtime text-surface
protection is the product.

---

## Concepts

### Alias format

`@<project>.<environment>.<key>` — kebab-case segments, e.g.
`@billing.prod.stripe_key`. Detection regex lives in
`packages/core/src/reference/types.ts`. Aliases survive everywhere a string
can: code, configs, shell commands, dotenv files, CI templates.

### Roles

Five-row, project-scoped permission matrix. Lives in `packages/rbac`.

| Role | What they can do |
|---|---|
| **Owner** | Everything; one per org; can rotate the master key |
| **Admin** | Manage projects, members, secrets, audit; can't transfer ownership |
| **Team Lead** | Per-project: add members, rotate secrets, grant production access |
| **Developer** | Read assigned secrets via alias; no UI access to plaintext values |
| **Reader** | Read-only on metadata; can't resolve values |

### Two primitives, one job

**1. Alias-first resolution.** Developers and agents reference
`@prod.database.url`. The runtime resolves the alias to the real
value ephemerally — inside a privileged subprocess your AI agent's
process tree cannot read. Output through the redactor. Audit trail
per resolution event.

```text
your code:           keynv exec -- mysql -p@billing.prod.db_password
                                       │
                                       ▼
the AI agent sees:   "@billing.prod.db_password" (just the alias literal)
the database sees:   the actual password (decrypted in a privileged subprocess)
```

**2. Text-surface scrubbing.** Every text surface where a secret
could leak — shell history files, Claude Code session JSONL, Cursor
logs, terminal stdout, CI output — is monitored, scrubbed, or
pre-empted. Five commands cover the lifecycle:

| Command | What it does |
|---|---|
| `keynv doctor` | Read-only retro scan; counts likely leaks across all known surfaces |
| `keynv scrub` | Atomic in-place rewrite with `.keynv.bak.<ts>` backups |
| `keynv shell install` | Preventive zsh/bash/fish history hook (pure regex, no per-command subprocess) |
| `keynv watch start` | Real-time chokidar daemon — scrubs live AI agent sessions on the fly |
| `keynv exec` | Alias resolution + automatically registers values with the running watcher so even custom-format secrets get caught |

The two layers compose. The alias half catches secrets before they
enter a surface. The scrubbing half catches the ones that slip through
(`cat .env`, a stack trace with a header, a copied error message).

---

## Quick start

### 1. Find out where you're leaking

```bash
npm install -g @keynv/cli
keynv doctor
```

Scan only — nothing is rewritten, no network calls. Match previews are
bounded to 3 characters; raw values never appear in the output.

### 2. Clean what's already there

```bash
keynv scrub --dry-run     # preview the plan
keynv scrub               # interactive confirm; atomic + backups
```

Files mtime'd in the last 10 seconds are skipped by default (likely
being actively written by a live AI session); pass `--include-active`
to override.

### 3. Prevent new leaks

```bash
keynv shell install       # marked block goes in your ~/.zshrc / ~/.bashrc
keynv shell status        # show what's installed where
keynv shell uninstall     # cleanly remove
```

The hook scrubs secret-shaped substrings before each command lands in
`~/.zsh_history`. POSIX-ERE regex (no per-command subprocess unless a
match fires). Pattern bank mirrors `@keynv/redactor`'s vendor-prefixed
tokens (AWS, GCP, GitHub, Stripe, JWT, Slack, OpenAI, Anthropic) plus
credential-bearing URIs.

### 4. Run the real-time watcher

```bash
keynv watch start         # foreground; Ctrl-C to stop
keynv watch status        # pid, surfaces, scrub counts
keynv watch stop          # SIGTERM → SIGKILL escalation after 15s
```

The watcher subscribes to `~/.claude/projects/**/*.jsonl` (Claude Code
transcripts) and `~/Library/Application Support/Cursor/logs/**/*.log`
(Cursor) via chokidar, debounces writes at 1 second, and atomically
rewrites matched substrings. Lifecycle and per-event audit lands in
`~/.local/share/keynv/watcher.log`.

### 5. Use aliases in your daily workflow

The self-host server + vault gives you alias storage. Initial setup:

- [Coolify walkthrough (recommended)](deploy/COOLIFY.md) — 15 minutes
- [Docker Compose guide](deploy/README.md)

Once deployed:

```bash
curl https://api.keynv.example.com/v1/health
keynv login               # browser flow; session lands in OS keychain
keynv project create demo
keynv secret create @demo.dev.api_key --value 'whatever'
```

Or use the menu — running `keynv` with no args in an interactive
terminal opens a TUI that walks through the same operations.

> Prefer a standalone binary over Node? Each release publishes
> `keynv-{darwin,linux,windows}-{arm64,x64}` archives at
> [GitHub Releases](https://github.com/keynv-labs/keynv/releases) with
> SHA256SUMS for verification.

### Daily use — `.keynv.env`

Run `keynv` in your project root and choose **Set up this project**. It creates a
`.keynv.env` file for you. **It is safe to commit** — it carries alias
references, never values.

```bash
# .keynv.env  (commit this!)
OPENAI_API_KEY=@demo.dev.openai-key
DATABASE_URL=@demo.prod.db-url
NODE_ENV=development      # plain literals work too
```

Then wrap whatever you'd normally run with `keynv exec`:

```bash
keynv exec -- npm run dev
keynv exec -- pytest
keynv exec -- next build
```

`keynv exec` walks up from your cwd to find `.keynv.env`, resolves every
`@alias` against the vault, and forks the subprocess with the real values in its
env. Your shell, your editor, and the AI agent driving the terminal never see
the resolved values — only the alias literals.

In `package.json` it disappears into the script:

```json
{
  "scripts": {
    "dev":  "keynv exec -- next dev",
    "test": "keynv exec -- vitest"
  }
}
```

> **Heads up — Next.js 16 + React 19 build worker:** the upstream
> `create-next-app@latest` template currently fails `next build` on
> `/_global-error` prerender (`Cannot read properties of null
> (reading 'useContext')`). This is a Next.js + React 19 template
> issue, NOT a keynv issue — the same scaffold fails without keynv
> in the loop. `next dev` works fine; for production builds either
> pin `next@15` or wait for the upstream fix.

---

## Status

| Phase | What | State |
|---|---|---|
| 0 | Discovery + spike measurements | done |
| 1 | Core vault: server, CLI, RBAC, audit, encryption | done |
| 2 | Alias resolution: `keynv exec`, `keynv-mcp`, redactor, installers | done |
| 3 | Connection testers: postgres, mysql, redis, ssh, http, AWS, GCP | done |
| 4 | Web UI for team leads (Next.js 15) | in progress (slice 9 of ~11) |
| A | **Runtime text-surface protection — primitives** (`doctor`, `scrub`, `shell install`, `watch`, fingerprint registry) | **done** |
| B | MCP capability tokens + `keynv.run` agent-bound subprocess execution | not started |
| C | First-class agent integrations (Claude Code skill, Cursor extension) | not started |

Versioning is unstable pre-1.0 — schemas, APIs, and config formats
may change without backwards-compatibility shims.

> A self-hosted Cloud option may exist later as a commercial
> deliverable. The OSS path is local-first and the only supported
> deployment for now. See [`docs/00-vision.md`](./docs/00-vision.md)
> for the positioning.

---

## Documentation

| | |
|---|---|
| [Vision](./docs/00-vision.md) | What keynv is, what it's not, where it goes |
| [Threat model](./docs/02-threat-model.md) | What we defend against, what we explicitly don't |
| [Text surfaces](./docs/03-text-surfaces.md) | The `TextSurface` contract, rewrite semantics, race window |
| [Architecture](./docs/01-architecture.md) | Components, data flow, trust boundaries |
| [Encryption design](./docs/05-encryption-design.md) | KEK / DEK split, libsodium primitives |
| [Backup/restore runbook](./docs/backup-restore-runbook.md) | RPO/RTO, restore drills, KEK loss handling |
| [API spec](./docs/06-api-spec.md) | HTTP endpoints |
| [API compatibility](./docs/api-compatibility.md) | CLI/server skew, feature flags, deprecation policy |
| [Roadmap](./docs/roadmap.md) | Phase status + active slice tracker |
| [Coolify deploy](./deploy/COOLIFY.md) | 15-min self-host walkthrough |
| [`CLAUDE.md`](./CLAUDE.md) | Working rules for humans + AI agents in this repo |

Stack: TypeScript everywhere; Bun for the CLI, Node 20+ for the server, Hono +
SQLite + Drizzle + libsodium. Full lock-list in [`CLAUDE.md`](./CLAUDE.md).

---

## License

Open core ships under **MIT** — see [`LICENSE`](./LICENSE). Decision rationale
in [`docs/decisions/0001-license-choice.md`](./docs/decisions/0001-license-choice.md).

The Phase 6 commercial modules (`packages/ee/*` — SSO, HSM, SIEM, multi-step
approvals) and the keynv Cloud service will ship under a separate commercial
license inside that subdirectory. The boundary is real: nothing under `ee/*`
imports into the open-core packages, and CI enforces it.
