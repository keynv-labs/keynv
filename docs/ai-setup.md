# Set up with your AI agent

keynv is built specifically for AI coding agents. After you install the CLI, the `keynv` TUI connects your account and wires the current project.

## The one command

Run this in your project root:

```bash
keynv
```

Choose **Set up this project**. The setup flow does three things:
1. Scans your `.env` files, uploads each secret to the vault, and generates `@project.env.key` aliases.
2. Writes a `.keynv.env` file containing alias references only — safe to commit.
3. Writes (or updates) an `AGENTS.md` file that tells your AI agent the mental model, the hard rules, and a quick-reference cheat sheet.

After that, every agent that indexes your repo — Claude Code, Cursor, Windsurf, Aider, Copilot, etc. — picks up `AGENTS.md` automatically on the next session.

---

## Copy-paste prompts

If you want to kick off setup from inside your agent instead of the terminal, copy one of these prompts and paste it into the chat.

### Set up keynv in this project (first time)

```
Set up keynv secrets management in this project.

Steps:
1. Run: npm install -g @keynv/cli
2. Run: keynv         (choose keynv.dev or self-hosted, opens browser auth)
3. Choose: Set up this project

After setup, always use `keynv exec -- <command>` when running anything that needs
environment variables. Never create .env files with real secret values.

Docs: https://keynv.dev/docs/ai-setup
```

### Explain keynv to an agent (project already set up)

Paste this if you're starting a new session in a repo that already has `.keynv.env`:

```
This project uses keynv for secrets management. Key rules for this session:

1. The `.keynv.env` file contains aliases like `DATABASE_URL=@billing.dev.db_url` —
   these are NOT real values, they are references to secrets stored in the vault.
2. To run commands that need env vars, use: keynv exec -- <command>
   Example: keynv exec -- pnpm dev
3. Never print, log, or write resolved secret values to any file or the chat.
4. To add a new secret: keynv secret create (interactive prompt)
5. To rotate a secret: keynv secret rotate @alias

Full details are in AGENTS.md in the project root.
```

### Add keynv to an existing Claude Code project

Append to your project's `CLAUDE.md`:

```markdown
## Secrets (keynv)

This project uses keynv. `.keynv.env` holds alias references; real values live in
the vault. All rules and context are in `AGENTS.md` — read that first.

Quick rules:
- Run commands with secrets: `keynv exec -- <command>`
- Add a secret: `keynv secret create`
- Never write resolved values to any file or the chat
```

---

## What AGENTS.md looks like

When the setup flow runs, it writes (or refreshes) a section like this in `AGENTS.md`:

```markdown
## keynv (secrets)

This project uses keynv for secrets. The `.keynv.env` file at the project root
contains alias references — NOT real values.

### Mental model

- `.keynv.env` — checked into git, contains aliases. Safe to read, edit, commit.
- Vault — holds real values. The `keynv` CLI reads it on demand.
- `keynv exec -- <command>` — forks the command in a subprocess where real values
  are injected. The parent process (where the AI agent runs) NEVER sees them.
- Redactor — masks secrets in subprocess output before they reach the terminal.

### What you should do

| User intent                   | Run / suggest                      |
|-------------------------------|-------------------------------------|
| Add a new API key             | `keynv secret create`              |
| Run the app / dev server      | `keynv exec -- <existing command>` |
| Show me the value of X        | `keynv secret get @alias --copy` — `--copy` copies to clipboard and never prints; without it the value goes to stdout |
| Rotate this key               | `keynv secret rotate @alias`       |
| Who has access?               | `keynv member list <project>`      |

### Hard rules

1. Never print resolved secret values to chat, terminal, log, or any file.
2. Never write a `.env` file containing real secret values.
3. Use `keynv exec --` to run commands that need env vars.
4. Treat the alias (`@project.env.key`) as the canonical reference.
```

The block is wrapped in HTML comment markers so re-running setup from `keynv` refreshes it without touching the rest of your `AGENTS.md`.

---

## Agent-specific notes

### Claude Code

The setup flow creates or updates `AGENTS.md`. Claude Code indexes this file
automatically. No additional config needed — restart Claude Code after setup.

For project-level rules you can also add the short "Secrets (keynv)" block above to
your `CLAUDE.md` so it's always in context even before `AGENTS.md` is indexed.

### Cursor / Windsurf

These agents read `AGENTS.md` as part of the repo index. No extra config needed.

### Aider

`aider --read AGENTS.md` — or add `--read AGENTS.md` to your `.aider.conf.yml`.

### Generic agent

Any agent that can read files in your repo will pick up `AGENTS.md`. If your agent
doesn't support a dedicated context file, paste the "Explain keynv" prompt above at
the start of each session.

---

## Keeping AGENTS.md up to date

Project setup is idempotent. Run `keynv` again whenever you add environments, add
new secrets, or upgrade the CLI — it refreshes only the keynv-managed block in
`AGENTS.md` and leaves your other content untouched.

```bash
keynv   # safe to re-run at any time
```

---

## MCP server (optional)

The CLI + `AGENTS.md` flow above is the recommended way to wire an agent. If your
agent speaks the Model Context Protocol, you can also run **keynv-mcp**, which
exposes keynv as MCP tools (`who_am_i`, `list_secrets`, `use_secret`,
`redact_text`, `test_connection`). It runs over stdio and inherits your logged-in
`keynv` session, so run `keynv login` (or `keynv`) on the same machine first.

Install it alongside the CLI:

```bash
npm install -g @keynv/mcp
```

**Claude Desktop / Claude Code** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "keynv": { "command": "keynv-mcp" }
  }
}
```

**Cursor** — add to `~/.cursor/mcp.json` (or a project-level `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "keynv": { "command": "keynv-mcp" }
  }
}
```

### How `use_secret` keeps the value away from the agent

`keynv.use_secret` never returns a raw value — it returns an opaque, single-use,
60-second reference token. The agent uses the token by running:

```bash
keynv exec --resolve DB_PASSWORD=<reference_token> -- <command>
```

`keynv exec` redeems the token through the running keynv-mcp server over a local
0600 same-user socket, injects the resolved value into the subprocess as
`DB_PASSWORD`, and redacts it from the subprocess output. The raw value never
crosses back to the agent.

> Register `keynv-mcp` by the binary on your PATH (or an absolute path). keynv does
> not write your agent's MCP config for you — point it at the installed binary.

---

## What's next

- [Quickstart](./quickstart.md) — deploy the server and install the CLI
- [Architecture](./01-architecture.md) — how the vault, CLI, MCP server, and redactor fit together
- [API specification](./06-api-spec.md) — build integrations against the keynv-server HTTP surface
