import { describe, expect, it, vi } from 'vitest';
import { requireServerFeature } from './compat.js';
import type { ApiClient } from './http.js';

describe('requireServerFeature', () => {
  it('allows advertised server features', async () => {
    const request = vi.fn().mockResolvedValue({
      version: '0.2.0',
      capabilities: { features: { batch_secret_create: true } },
    });

    await expect(
      requireServerFeature(
        { request } as unknown as ApiClient,
        'batch_secret_create',
        'upload secrets',
      ),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/v1/health', { authed: false });
  });

  it('treats missing feature flags as unsupported', async () => {
    const request = vi.fn().mockResolvedValue({
      version: '0.1.0-rc.1',
      capabilities: { public_registration: false },
    });

    await expect(
      requireServerFeature(
        { request } as unknown as ApiClient,
        'environment_management',
        'add envs',
      ),
    ).rejects.toThrow('does not advertise environment_management');
  });
});
