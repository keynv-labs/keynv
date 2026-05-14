'use server';

import { api } from '@/lib/api';

export interface Preferences {
  approval_requests: boolean;
  secret_changes: boolean;
  member_changes: boolean;
  activity_digest: 'daily' | 'weekly' | 'never';
}

export async function loadPreferences(): Promise<Preferences> {
  return api('/v1/users/preferences');
}

export async function savePreferences(prefs: Partial<Preferences>): Promise<{ ok: boolean }> {
  return api('/v1/users/preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
}
