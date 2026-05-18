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

const featureCache = new WeakMap<ApiClient, Map<ServerFeature, boolean>>();

export async function requireServerFeature(
  client: ApiClient,
  feature: ServerFeature,
  action: string,
): Promise<void> {
  let cache = featureCache.get(client);
  if (!cache) {
    cache = new Map();
    featureCache.set(client, cache);
  }
  const cached = cache.get(feature);
  if (cached === true) return;
  if (cached === false) {
    throw new Error(
      `server does not advertise ${feature}; cannot ${action}. Upgrade the keynv server or use a CLI version compatible with this deployment.`,
    );
  }

  const health = await client.request<ServerHealth>('/v1/health', { authed: false });
  const supported = health.capabilities?.features?.[feature] === true;
  cache.set(feature, supported);
  if (supported) return;

  throw new Error(
    `server ${health.version} does not advertise ${feature}; cannot ${action}. Upgrade the keynv server or use a CLI version compatible with this deployment.`,
  );
}
