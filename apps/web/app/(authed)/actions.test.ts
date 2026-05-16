import { describe, expect, it, vi } from 'vitest';

const { apiMock } = vi.hoisted(() => ({
  apiMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: apiMock,
}));

// next/navigation.redirect throws — the helpers we don't exercise here
// still get imported by actions.ts, so stub them to keep imports happy.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__redirect__:${path}`);
  }),
}));

import { createCsrfToken } from '@/lib/csrf';
import { dismissOnboardingAction } from './actions';

describe('dismissOnboardingAction', () => {
  it('does not call the API when the csrf token is missing', async () => {
    apiMock.mockReset();
    await dismissOnboardingAction(null);
    await dismissOnboardingAction(undefined);
    await dismissOnboardingAction('');
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('does not call the API when the csrf token is forged', async () => {
    apiMock.mockReset();
    await dismissOnboardingAction('not-a-valid-token.signature');
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('calls the API when a valid csrf token is presented', async () => {
    apiMock.mockReset();
    apiMock.mockResolvedValue(undefined);
    await dismissOnboardingAction(createCsrfToken());
    expect(apiMock).toHaveBeenCalledWith('/v1/onboarding/dismiss', { method: 'POST' });
  });
});
