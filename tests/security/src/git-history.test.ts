import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §"Agent runs git log / git diff".
// Two layers: a pre-commit hook (gitleaks) keeps new secrets out, and the
// redactor masks anything still present in history when the agent reads
// VCS output.

describe('git-history: VCS output redaction', () => {
  it.todo('pre-commit hook (gitleaks) blocks committing a postgres connection URL');
  it.todo('pre-commit hook blocks AWS access key id');
  it.todo('git diff output containing postgres URL is redacted before reaching the agent');
  it.todo('git log output containing JWT-shaped tokens is redacted');
  it.todo('redactor handles multi-line RSA private keys spanning many diff hunks');
});
