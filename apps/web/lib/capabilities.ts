import { api } from './api';

interface HealthResponse {
  ok: boolean;
  capabilities?: { public_registration?: boolean };
}

export interface Capabilities {
  publicSignup: boolean;
}

/**
 * Cheap unauthenticated probe of the server's feature flags. Used by
 * the landing page, /login, and /register to decide whether to expose
 * the sign-up flow on this instance.
 *
 * Default failure mode: assume the most locked-down self-host instance
 * (no public signup). /register passes `fallback: { publicSignup: true }`
 * so a transient API outage doesn't masquerade as "signup disabled".
 */
export async function getCapabilities(
  opts: { fallback?: Partial<Capabilities> } = {},
): Promise<Capabilities> {
  try {
    const health = await api<HealthResponse>('/v1/health', { authed: false });
    return { publicSignup: health.capabilities?.public_registration === true };
  } catch {
    return { publicSignup: opts.fallback?.publicSignup ?? false };
  }
}
