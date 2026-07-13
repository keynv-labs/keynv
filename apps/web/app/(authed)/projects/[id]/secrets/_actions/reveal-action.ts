'use server';

import { catchApi, parseOr } from '@/lib/action-result';
import { api } from '@/lib/api';
import { requireCsrf } from '@/lib/csrf';
import { envName, projectId, secretKey } from '@/lib/schemas';
import { z } from 'zod';

export type RevealActionState = {
  value?: string;
  version?: number;
  error?: string;
};

const Body = z.object({
  project_id: projectId,
  env: envName,
  key: secretKey,
});

/**
 * Reveals a secret's decrypted value for display in the panel. Hits the
 * same `GET /v1/projects/{id}/secrets/{env}/{key}` endpoint the CLI uses,
 * so the server enforces the `secret.read` RBAC capability + the
 * production-approval flow and records a `secret.read.allowed` audit
 * event for every reveal. The plaintext only leaves the server when a
 * user explicitly asks for it — it is never included in the page payload.
 */
export async function revealSecretAction(
  _prev: RevealActionState,
  formData: FormData,
): Promise<RevealActionState> {
  const csrf = requireCsrf(formData);
  if (csrf) return csrf;

  const parsed = parseOr(Body, formData, ['project_id', 'env', 'key']);
  if (!parsed.success) return { error: parsed.error };

  const result = await catchApi(() =>
    api<{ alias: string; value: string; version: number }>(
      `/v1/projects/${parsed.data.project_id}/secrets/${parsed.data.env}/${parsed.data.key}`,
    ),
  );
  if (!result.success) return { error: result.error };
  return { value: result.data.value, version: result.data.version };
}
