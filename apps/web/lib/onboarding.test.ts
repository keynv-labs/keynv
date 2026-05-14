import { describe, it, expect } from 'vitest';
import { completedStepCount, isOnboardingComplete } from './onboarding';

describe('completedStepCount', () => {
  it('returns 0 when no steps done', () => {
    expect(
      completedStepCount({
        project_created: false,
        secret_added: false,
        cli_authenticated: false,
        integration_installed: false,
        dismissed: false,
      }),
    ).toBe(0);
  });

  it('counts completed steps', () => {
    expect(
      completedStepCount({
        project_created: true,
        secret_added: false,
        cli_authenticated: true,
        integration_installed: false,
        dismissed: false,
      }),
    ).toBe(2);
  });

  it('returns 4 when all steps done', () => {
    expect(
      completedStepCount({
        project_created: true,
        secret_added: true,
        cli_authenticated: true,
        integration_installed: true,
        dismissed: false,
      }),
    ).toBe(4);
  });

  it('ignores the dismissed field in count', () => {
    const withDismiss = completedStepCount({
      project_created: true,
      secret_added: true,
      cli_authenticated: true,
      integration_installed: true,
      dismissed: true,
    });
    expect(withDismiss).toBe(4);
  });
});

describe('isOnboardingComplete', () => {
  it('returns false when not all steps done', () => {
    expect(
      isOnboardingComplete({
        project_created: true,
        secret_added: true,
        cli_authenticated: false,
        integration_installed: false,
        dismissed: false,
      }),
    ).toBe(false);
  });

  it('returns true when all 4 steps done', () => {
    expect(
      isOnboardingComplete({
        project_created: true,
        secret_added: true,
        cli_authenticated: true,
        integration_installed: true,
        dismissed: false,
      }),
    ).toBe(true);
  });
});
