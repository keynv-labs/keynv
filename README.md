<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./demo/logo-dark.svg">
    <img alt="keynv" src="./demo/logo-light.svg" height="44">
  </picture>
</h1>

> Self-hosted secrets vault for teams and AI-assisted development.

[![release](https://img.shields.io/github/v/release/keynv-labs/keynv?include_prereleases&sort=semver&color=F59E0B&label=release)](https://github.com/keynv-labs/keynv/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/keynv-labs/keynv/ci.yml?branch=main&label=ci)](https://github.com/keynv-labs/keynv/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Store your API keys, database URLs, and other secrets in one self-hosted
vault. Reference them everywhere by alias — `@project.env.key` — instead of the
real value. keynv resolves aliases into your app at runtime, so the real values
never touch your code, your shell history, or your AI agent's transcripts. Your
agent sees `@billing.prod.stripe_key`, never the key itself.

---

## Quick start

Two ways to get a vault — use the hosted **keynv.dev**, or run your own. Either
way you drive everything from the `keynv` CLI.

### Option A · Use keynv.dev (hosted — fastest)

1. Create a free account at **[keynv.dev/register](https://keynv.dev/register)**.
2. Install the CLI and connect:

   ```bash
   npm install -g @keynv/cli
   keynv                       # pick "keynv.dev", then "Set up this project"
   ```

### Option B · Self-host the server + panel

Point Coolify (or Docker Compose) at `deploy/coolify.yml` and set just two
values — the owner email and password. The encryption keys, JWT secret, and web
session secret are all generated automatically on first boot. See the
[Coolify walkthrough](deploy/COOLIFY.md) or the
[Docker Compose guide](deploy/README.md). Then connect the CLI to your server:

```bash
npm install -g @keynv/cli
keynv                       # pick "Self-hosted server", enter your API URL
```

### Set up your project, then run it normally

`keynv` opens an interactive menu: it logs you in, imports any existing `.env`
files into the vault, and writes a committable `.keynv.env` that maps your
environment variables to aliases. Setup also wraps your `package.json` scripts,
so you just run them the way you already do:

```bash
npm run dev        # secrets injected automatically — no `keynv exec` to type
npm test
```

keynv resolves the aliases and injects the real values into the process,
redacting them from any output. **You never type `keynv exec` yourself.**

---

## How it works

`.keynv.env` is safe to commit — it holds references, not values:

```bash
OPENAI_API_KEY=@myapp.dev.openai-key
DATABASE_URL=@myapp.prod.db-url
NODE_ENV=development           # plain literals pass through unchanged
```

Behind the scenes your wrapped script runs `keynv exec -- <your command>`.
`keynv exec` finds `.keynv.env`, resolves each `@alias` against the vault, and
forks your command with the real values in its environment — inside a subprocess
your editor and AI agent can't read. For a one-off command you can run
`keynv exec -- <cmd>` directly.

Teams get project-scoped roles (owner / admin / developer / reader), per-secret
access, rotation, and a tamper-evident audit log — all managed from the CLI or
the web panel.

---

## Also: clean up leaks you already have

Secrets already sitting in your shell history or AI transcripts? These commands
run entirely locally — no server or login needed:

```bash
keynv doctor         # scan for leaked secrets (read-only, no network)
keynv scrub          # clean them up, atomically, with backups
keynv watch start    # scrub live AI-agent sessions in real time
```

![keynv doctor finds leaked secrets, then scrub cleans them and doctor reports clean — recorded against a throwaway demo sandbox of fake secrets](./demo/keynv-doctor.gif)

---

## Documentation

| | |
|---|---|
| [Getting started](./docs/getting-started.md) | First run and core commands |
| [Quickstart](./docs/quickstart.md) | Self-host to first secret, end to end |
| [Coolify deploy](./deploy/COOLIFY.md) | Self-host walkthrough |
| [AI setup](./docs/ai-setup.md) | Wire keynv into Claude Code / Cursor / MCP |
| [Architecture](./docs/01-architecture.md) · [Threat model](./docs/02-threat-model.md) · [API](./docs/06-api-spec.md) | Design + reference |

Pre-1.0 — schemas, APIs, and config formats may change without back-compat shims.

## License

MIT — see [`LICENSE`](./LICENSE).
