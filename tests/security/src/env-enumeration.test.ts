import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §"Agent runs env / printenv".
// keynv exec spawns subprocesses with a curated env (allowlist), so the
// shell that the AI agent runs commands in does not contain secret values
// in the first place. The redactor catches anything that slips through.

describe('env-enumeration: env / printenv leak prevention', () => {
  it.todo('keynv exec subprocess does not inherit caller-shell secret-shaped env vars');
  it.todo('printenv output passes through redactor before reaching the agent');
  it.todo('redactor masks AWS access key id pattern (AKIA...) in subprocess stdout');
  it.todo('redactor masks high-entropy strings adjacent to "password"/"secret"/"token" hints');
  it.todo('redactor preserves non-secret high-entropy strings (UUIDs, git SHAs) by default');
});
