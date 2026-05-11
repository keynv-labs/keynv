import { cancel, group, password, spinner, text } from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';
import { saveCredentials } from '../../client/store.js';
import { AGENT } from '../../version.js';
import { UserCancelled } from '../helpers/cancel.js';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string; org_id: string; org_role: string };
}

/**
 * Interactive clack login flow. Asks for server URL, email, password; on
 * success persists credentials and returns true. Throws UserCancelled if
 * the user hits Ctrl+C at any prompt. Returns false if the API rejects
 * the credentials (allows the menu to re-prompt).
 */
export async function runLoginFlow(client: ApiClient): Promise<boolean> {
  const answers = await group(
    {
      server: () =>
        text({
          message: 'Server URL',
          placeholder: 'http://localhost:8080',
          defaultValue: 'http://localhost:8080',
        }),
      email: () =>
        text({
          message: 'Email',
          validate: (v) => (v?.includes('@') ? undefined : 'enter an email'),
        }),
      password: () =>
        password({
          message: 'Password',
          validate: (v) => (v && v.length >= 1 ? undefined : 'required'),
        }),
    },
    {
      onCancel: () => {
        throw new UserCancelled();
      },
    },
  );

  const server = answers.server || 'http://localhost:8080';
  const s = spinner();
  s.start('Authenticating');
  let res: Response;
  try {
    res = await fetch(new URL('/v1/auth/login', server).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-keynv-agent': AGENT },
      body: JSON.stringify({ email: answers.email, password: answers.password }),
    });
  } catch (err) {
    s.error('Network error');
    cancel(err instanceof Error ? err.message : 'unreachable');
    return false;
  }

  if (!res.ok) {
    let msg = `login failed (${res.status})`;
    try {
      const parsed = (await res.json()) as { error?: { message?: string } };
      msg = parsed.error?.message ?? msg;
    } catch {
      // ignore
    }
    s.error(msg);
    return false;
  }

  const data = (await res.json()) as LoginResponse;
  await saveCredentials({
    server_url: server,
    user_id: data.user.id,
    email: data.user.email,
    org_id: data.user.org_id,
    org_role: data.user.org_role,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  });
  await client.setCredentials({
    server_url: server,
    user_id: data.user.id,
    email: data.user.email,
    org_id: data.user.org_id,
    org_role: data.user.org_role,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  });
  s.stop(`Logged in as ${data.user.email}`);
  return true;
}
