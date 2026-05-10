import { isCancel, select } from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';

interface SecretSummary {
  alias: string;
  version: number;
  created_at: string;
}

export async function listSecrets(client: ApiClient, projectId: string): Promise<SecretSummary[]> {
  const data = await client.request<{ secrets: SecretSummary[] }>(
    `/v1/projects/${projectId}/secrets`,
  );
  return data.secrets;
}

export async function pickSecret(
  client: ApiClient,
  projectId: string,
  message = 'Secret:',
): Promise<SecretSummary | null> {
  const secrets = await listSecrets(client, projectId);
  if (secrets.length === 0) return null;
  const value = await select({
    message,
    options: secrets.map((s) => ({
      value: s.alias,
      label: s.alias,
      hint: `v${s.version}`,
    })),
  });
  if (isCancel(value)) return null;
  return secrets.find((s) => s.alias === value) ?? null;
}
