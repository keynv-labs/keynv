import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §"Tool output reaches LLM provider logs".
// The privileged subprocess approach: AI agents only ever see the literal
// `@project.env.key` in tool inputs/outputs; resolved values land only in
// the subprocess argv/env/stdin and are never sent back through the agent.

describe('privileged-subprocess: value never enters the agent process tree', () => {
  it.todo(
    'keynv exec resolves @aliases in argv before fork-exec; agent sees only the alias literal in tool input',
  );
  it.todo('subprocess argv is not visible to the agent process via /proc inspection');
  it.todo(
    'keynv exec strips secret-shaped env vars from the subprocess env unless explicitly via --via-env',
  );
  it.todo(
    '--via-stdin alias path delivers the value through stdin and never appears in argv',
  );
  it.todo('subprocess stdout/stderr is line-buffered through the redactor before the agent reads it');
  it.todo('--no-redact requires explicit flag and emits an audit warning');
});
