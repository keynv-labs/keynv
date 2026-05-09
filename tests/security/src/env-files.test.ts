import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §"Agent reads .env directly".
// Phase 2 wires `keynv install <agent>` integrations that block agent file
// tools (or at minimum hide files via ignore lists) for `.env`, `*.pem`,
// `id_rsa*`, `*credentials*`. Each integration is exercised here.

describe('env-files: agent file-tool denial', () => {
  it.todo('Claude Code Read tool is denied for .env files when keynv-guard hook is installed');
  it.todo('Claude Code Read tool is denied for *.pem files');
  it.todo('Claude Code Read tool is denied for id_rsa* files');
  it.todo('Cursor honors .cursorignore for .env after keynv install cursor');
  it.todo('Aider honors .aiderignore for .env after keynv install aider');
  it.todo('OpenCode integration prevents file tools from reading .env (mechanism TBD by Phase 2)');
  it.todo('Codex CLI shell wrapper resists `cat .env` via deny list');
});
