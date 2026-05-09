import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §"Compromised dependency in agent process"
// + LLM03/Supply-chain. MCP `use_secret(alias)` must NEVER return a raw
// value; only single-use, short-lived reference tokens. Resolution happens
// inside the privileged subprocess.

describe('mcp-reference-token: tokens, never values', () => {
  it.todo('keynv.use_secret returns a reference_token, not a value');
  it.todo('reference_token has TTL ≤ 60 seconds');
  it.todo('reference_token is single-use; reuse returns an explicit replay error');
  it.todo('reference_token resolution is bound to the subprocess pid that requested it');
  it.todo('keynv.list_secrets returns only alias names (no values, no metadata that leaks values)');
  it.todo(
    'keynv.test_connection returns ok/latency/sanitized error; the value never leaves the runner',
  );
});
