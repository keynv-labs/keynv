import 'server-only';
import { api } from './api';
import type { OnboardingStatus } from './onboarding';

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return api<OnboardingStatus>('/v1/onboarding/status');
}
