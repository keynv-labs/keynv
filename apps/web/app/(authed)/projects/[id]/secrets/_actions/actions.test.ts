import { describe, expect, it, vi } from 'vitest';

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: apiMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createSecretAction } from './actions';

describe('secret actions', () => {
  it('rejects missing csrf before calling the API', async () => {
    const formData = new FormData();
    formData.set('project_id', 'proj_123');
    formData.set('env', 'dev');
    formData.set('key', 'DATABASE_URL');
    formData.set('value', 'postgres://example');

    await expect(createSecretAction({}, formData)).resolves.toEqual({
      error: 'Security check failed. Refresh the page and try again.',
    });
    expect(apiMock).not.toHaveBeenCalled();
  });
});
