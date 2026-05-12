import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §"Agent reads .env directly".
// `keynv init` migrates .env files to the vault and writes .keynv.env (alias refs only).
// The agent never sees raw values; .env files no longer exist with values in them.

describe('env-files: agent file-tool denial', () => {
  it.skip(
    'placeholder — keynv init removes the target: .env files no longer contain values, only alias refs',
  );
});
