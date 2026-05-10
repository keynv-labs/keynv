import { cancel, intro, isCancel, log, outro, select } from '@clack/prompts';
import { ApiClient } from '../client/http.js';
import { clearCredentials } from '../client/store.js';
import { fmtError } from './format.js';
import { UserCancelled } from './helpers/cancel.js';
import { runAuditFlow } from './flows/audit.js';
import { runLoginFlow } from './flows/login.js';
import { runMembersFlow } from './flows/member.js';
import { runProjectsFlow } from './flows/project.js';
import { runSecretsFlow } from './flows/secret.js';
import { VERSION } from '../version.js';

/**
 * Top-level interactive loop. Returns the process exit code.
 */
export async function runMenu(): Promise<number> {
  intro(`keynv ${VERSION}`);

  const client = new ApiClient();
  await client.ensureHydrated();

  if (!client.isLoggedIn) {
    log.info('Not logged in.');
    try {
      const ok = await runLoginFlow(client);
      if (!ok) {
        outro('Login cancelled.');
        return 1;
      }
    } catch (err) {
      if (err instanceof UserCancelled) {
        cancel('Login cancelled.');
        return 130;
      }
      throw err;
    }
  } else {
    const u = client.currentUser;
    if (u) log.message(`${u.email} (${u.org_role}) @ ${u.server_url}`);
  }

  while (true) {
    let choice: string;
    try {
      const value = await select({
        message: 'What now?',
        options: [
          { value: 'projects', label: 'Projects' },
          { value: 'secrets', label: 'Secrets' },
          { value: 'members', label: 'Members' },
          { value: 'audit', label: 'Audit log' },
          { value: 'logout', label: 'Logout' },
          { value: 'exit', label: 'Exit' },
        ],
      });
      if (isCancel(value)) {
        outro('Bye.');
        return 0;
      }
      choice = value as string;
    } catch (err) {
      if (err instanceof UserCancelled) {
        outro('Bye.');
        return 0;
      }
      throw err;
    }

    try {
      if (choice === 'exit') {
        outro('Bye.');
        return 0;
      }
      if (choice === 'logout') {
        try {
          await client.request('/v1/auth/logout', {
            method: 'POST',
            body: { refresh_token: client.currentUser?.refresh_token },
          });
        } catch {
          // best-effort
        }
        clearCredentials();
        client.clearCredentials();
        outro('Logged out.');
        return 0;
      }
      if (choice === 'projects') await runProjectsFlow(client);
      else if (choice === 'secrets') await runSecretsFlow(client);
      else if (choice === 'members') await runMembersFlow(client);
      else if (choice === 'audit') await runAuditFlow(client);
    } catch (err) {
      if (err instanceof UserCancelled) {
        log.warn('Cancelled.');
        continue;
      }
      const e = err as { code?: string; message: string; status?: number };
      log.error(fmtError(e));
    }
  }
}
