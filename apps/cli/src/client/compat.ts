import type { ApiClient } from './http.js';

export type ServerFeature =
  | 'batch_secret_create'
  | 'environment_management'
  | 'health_probes'
  | 'prometheus_metrics';

interface ServerHealth {
  version: string;
  capabilities?: {
    features?: Partial<Record<ServerFeature, boolean>>;
  };
}

export async function requireServerFeature(
  client: ApiClient,
  feature: ServerFeature,
  action: string,
): Promise<void> {
  const health = await client.request<ServerHealth>('/v1/health', { authed: false });
  if (health.capabilities?.features?.[feature] === true) return;

  throw new Error(
    `server ${health.version} does not advertise ${feature}; cannot ${action}. Upgrade the keynv server or use a CLI version compatible with this deployment.`,
  );
}
