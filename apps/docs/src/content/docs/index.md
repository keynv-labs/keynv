---
title: keynv
description: AI-safe secrets management. Aliases instead of values; AI agents never see real secrets.
template: splash
hero:
  tagline: AI-safe secrets management. Aliases instead of values; AI agents never see real secrets.
  actions:
    - text: Get started in 5 minutes
      link: /getting-started/
      icon: right-arrow
      variant: primary
    - text: Why keynv?
      link: /engineering/00-vision-and-scope/
      icon: open-book
---

import { CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

## What problem keynv solves

Developers leak `.env` files, API keys, DB passwords, SSH credentials, and tokens — and AI coding agents (Claude Code, OpenCode, Cursor, Codex CLI, Aider) make it worse: every command they run, every file they read, every diff they show forwards secrets to the LLM provider.

`keynv` replaces secret values with aliases. Your code, configs, and AI-agent inputs reference `@billing.prod.db_password`. The actual value lives in an encrypted vault and is injected into a privileged subprocess that the agent's process tree never sees. Tool outputs are scanned and redacted. Agents see only the alias literal.

<CardGrid>
  <Card title="Alias-only inputs" icon="approve-check">
    The agent reads, writes, and reasons over `@project.env.key`. Real values stay out of its context.
  </Card>
  <Card title="Privileged subprocess" icon="puzzle">
    `keynv exec --` resolves and injects the value into a fork-exec'd subprocess that does not inherit the agent's env / fd / cwd.
  </Card>
  <Card title="Streaming redactor" icon="seti:lock">
    Subprocess stdout/stderr is line-buffered through a regex + entropy redactor before reaching the agent's tool channel.
  </Card>
  <Card title="MCP, but safer" icon="setting">
    `keynv-mcp` returns single-use, 60-second reference tokens. Even a compromised agent never holds a raw value.
  </Card>
</CardGrid>

## Try it

<CardGrid>
  <LinkCard
    title="Self-host with Docker"
    href="/deploy/docker-compose/"
    description="A single VM, a docker-compose stack, and a Litestream sidecar replicating the SQLite WAL to S3 for disaster recovery."
  />
  <LinkCard
    title="Wire up your AI agent"
    href="/integrations/overview/"
    description="Per-agent installers for Claude Code, Cursor, OpenCode, Codex CLI, and Aider. One command, idempotent."
  />
  <LinkCard
    title="Read the threat model"
    href="/engineering/02-threat-model/"
    description="STRIDE + OWASP LLM Top 10 coverage, the documented attack vectors keynv defends against, and the limits we're honest about."
  />
</CardGrid>
