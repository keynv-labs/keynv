import { describe, it } from 'vitest';

// Threat model: docs/02-threat-model.md §"Indirect prompt injection".
// The agent may be tricked into using a privileged alias. Mitigation is
// RBAC + production-tier approval workflow + audit. We cannot prevent
// the agent from being deceived; we limit the blast radius.

describe('indirect-prompt-injection: blast-radius containment', () => {
  it.todo('developer role cannot resolve a production-tier alias without approval');
  it.todo('approval workflow requires a separate user (lead/admin) to grant');
  it.todo('approved access is bounded by a short TTL (default 30 minutes)');
  it.todo('every approval grant and denial is recorded in the audit chain');
  it.todo(
    'attempting to read a prod-tier alias from a developer-role session emits secret.read.denied',
  );
});
