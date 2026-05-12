/**
 * Pure types + utilities for the onboarding checklist. NO `@/lib/api`
 * import — `api.ts` transitively pulls in `next/headers` via the
 * session helper, which can't load in a Client Component. The
 * server-side fetcher lives in `lib/onboarding-server.ts`.
 */

export interface OnboardingStatus {
  project_created: boolean;
  secret_added: boolean;
  cli_authenticated: boolean;
  integration_installed: boolean;
}

/**
 * Number of checklist steps. Kept here so the empty state and the
 * progress meter agree without a runtime count.
 */
export const ONBOARDING_STEPS = 4;

export function completedStepCount(status: OnboardingStatus): number {
  let n = 0;
  if (status.project_created) n += 1;
  if (status.secret_added) n += 1;
  if (status.cli_authenticated) n += 1;
  if (status.integration_installed) n += 1;
  return n;
}

export function isOnboardingComplete(status: OnboardingStatus): boolean {
  return completedStepCount(status) === ONBOARDING_STEPS;
}

export const DISMISS_STORAGE_KEY = 'keynv-onboarding-dismissed';
