# @keynv/cli

> Self-hosted secrets vault for teams and AI-assisted development.

[![npm](https://img.shields.io/npm/v/@keynv/cli?color=F59E0B)](https://www.npmjs.com/package/@keynv/cli)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/keynv-labs/keynv/blob/main/LICENSE)

Store your API keys, database URLs, and other secrets in one vault — hosted on
[keynv.dev](https://keynv.dev) or self-hosted — and reference them everywhere by
alias (`@project.env.key`) instead of the real value. `keynv` resolves aliases
into your app at runtime, so the real values never touch your code, your shell
history, or your AI agent's transcripts. Your agent sees
`@billing.prod.stripe_key`, never the key itself.

## Install

```bash
npm install -g @keynv/cli
```

Node 20+. Prefer a standalone binary over Node? Every
[release](https://github.com/keynv-labs/keynv/releases) publishes signed
executables for macOS / Linux / Windows with a `SHA256SUMS` manifest.

## Quick start

### Option A · Use keynv.dev (hosted — fastest)

1. Create a free account at [keynv.dev/register](https://keynv.dev/register).
2. Connect and set up your project:

   ```bash
   keynv                       # pick "keynv.dev", then "Set up this project"
   ```

### Option B · Self-host

Run your own server + panel in ~15 minutes — see the
[Coolify walkthrough](https://github.com/keynv-labs/keynv/blob/main/deploy/COOLIFY.md)
or [Docker Compose guide](https://github.com/keynv-labs/keynv/blob/main/deploy/README.md).
Then run `keynv`, choose **Self-hosted server**, and enter your API URL.

> On a headless Linux box with no OS keychain (no libsecret), set
> `KEYNV_DISABLE_KEYCHAIN=1` before connecting — credentials then persist to an
> encrypted file instead of the system keychain.

### Then run your app — the way you already do

Setup imports your existing `.env` files into the vault and writes a committable
`.keynv.env` that maps your environment variables to aliases. It also wraps your
`package.json` scripts, so you just run them normally:

```bash
npm run dev                    # secrets injected automatically — no `keynv exec` to type
npm test
```

`.keynv.env` is safe to commit — it holds references, not values:

```bash
OPENAI_API_KEY=@myapp.dev.openai-key
DATABASE_URL=@myapp.prod.db-url
NODE_ENV=development           # plain literals pass through unchanged
```

Behind the scenes your wrapped script runs `keynv exec -- <your command>`, which
resolves each `@alias` against the vault and forks your command with the real
values in a subprocess your editor and AI agent can't read — redacting them from
output. **You never type `keynv exec` yourself.**

Teams get project-scoped roles (owner / admin / developer / reader), per-secret
access, rotation, and a tamper-evident audit log — all managed from the CLI or
the web panel.

## Common commands

```bash
keynv                          # interactive TUI (projects, secrets, members)
keynv secret create            # add a secret to the vault
keynv secret get @a.dev.key --copy   # copy a value to the clipboard without printing it
keynv exec -- <cmd>            # run a one-off command with aliases resolved
keynv member list <project>    # who has access to a project
keynv whoami                   # who am I logged in as
keynv --help                   # full command list
```

## Use with Claude Code / Cursor (MCP)

`keynv` pairs with an MCP server so AI agents can reference secrets by alias and
never see the value. See the
[AI setup guide](https://github.com/keynv-labs/keynv/blob/main/docs/ai-setup.md)
for wiring it into Claude Code, Cursor, and other MCP clients.

## Also: clean up leaks you already have

Secrets already sitting in your shell history or AI transcripts? These commands
run entirely locally — no server or login needed:

```bash
keynv doctor                   # scan for leaked secrets (read-only, no network)
keynv scrub                    # clean them up, atomically, with backups
keynv watch start              # scrub live AI-agent sessions in real time
```

Match previews are bounded to 3 characters; raw secret values never appear in
output.

## Documentation

- [Getting started](https://github.com/keynv-labs/keynv/blob/main/docs/getting-started.md)
- [AI setup (Claude Code / Cursor / MCP)](https://github.com/keynv-labs/keynv/blob/main/docs/ai-setup.md)
- [Coolify deploy](https://github.com/keynv-labs/keynv/blob/main/deploy/COOLIFY.md)
- [Threat model](https://github.com/keynv-labs/keynv/blob/main/docs/02-threat-model.md)
- [Full README](https://github.com/keynv-labs/keynv#readme)

## License

[MIT](https://github.com/keynv-labs/keynv/blob/main/LICENSE) © keynv-labs and contributors
