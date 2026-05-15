import { cancel, spinner } from '@clack/prompts';
import { runBrowserAuth } from '../../client/browser-auth.js';
import { DEFAULT_SERVER_URL } from '../../client/defaults.js';
import type { ApiClient } from '../../client/http.js';
import type { Credentials } from '../../client/store.js';

/**
 * Opens browser auth, persists credentials, and returns true. Returns
 * false if the API rejects the flow so the menu can exit cleanly.
 */
export async function runLoginFlow(
  client: ApiClient,
  options: { server?: string } = {},
): Promise<boolean> {
  const server = options.server ?? DEFAULT_SERVER_URL;
  const s = spinner();
  s.start(`Opening browser for ${server}`);
  let creds: Credentials;
  try {
    creds = await runBrowserAuth(server);
  } catch (err) {
    s.error('Browser login failed');
    cancel(err instanceof Error ? err.message : 'Unable to authenticate.');
    return false;
  }

  await client.setCredentials(creds);
  s.stop(`Logged in as ${creds.email}`);
  return true;
}
