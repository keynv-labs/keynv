import { cancel, confirm, intro, isCancel, log, outro, select, text } from '@clack/prompts';
import { DEFAULT_SERVER_URL, DEFAULT_WEB_URL } from '../client/defaults.js';
import { ApiClient } from '../client/http.js';
import { clearCredentials } from '../client/store.js';
import { findProjectRoot, hasExistingKeynvEnv } from '../init/detect.js';
import { VERSION } from '../version.js';
import { runAuditFlow } from './flows/audit.js';
import { runLoginFlow } from './flows/login.js';
import { runMembersFlow } from './flows/member.js';
import { runProjectsFlow } from './flows/project.js';
import { runSecretsFlow } from './flows/secret.js';
import { fmtError } from './format.js';
import { UserCancelled } from './helpers/cancel.js';

/**
 * Top-level interactive loop. Returns the process exit code.
 */
export async function runMenu(): Promise<number> {
  intro(`keynv ${VERSION}`);

  const client = new ApiClient();
  await client.ensureHydrated();
  let didLogin = false;

  if (!client.isLoggedIn) {
    const server = await pickConnectionTarget();
    if (server === null) {
      outro('Bye.');
      return 0;
    }
    try {
      const ok = await runLoginFlow(client, { server });
      if (!ok) {
        outro('Connection cancelled.');
        return 1;
      }
      didLogin = true;
    } catch (err) {
      if (err instanceof UserCancelled) {
        cancel('Connection cancelled.');
        return 130;
      }
      throw err;
    }
  } else {
    const u = client.currentUser;
    if (u) log.message(`${u.email} (${u.org_role}) @ ${u.server_url}`);
  }

  if (didLogin) {
    const root = findProjectRoot(process.cwd());
    const alreadyInitialized = root !== null && hasExistingKeynvEnv(root.path);
    if (!alreadyInitialized) {
      const setup = await confirm({
        message: 'Set up this project now?',
        initialValue: true,
      });
      if (!isCancel(setup) && setup) {
        const { runInitFlow } = await import('./flows/init.js');
        const outcome = await runInitFlow(client, {
          cwd: process.cwd(),
          dryRun: false,
          noScripts: false,
        });
        if (outcome.exitCode === 0) {
          outro('All set. Run keynv again anytime to manage secrets.');
          return 0;
        }
      }
    }
  }

  while (true) {
    let choice: string;
    try {
      const value = await select({
        message: 'What now?',
        options: [
          { value: 'init', label: 'Set up this project', hint: 'migrate .env into keynv' },
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
      if (choice === 'init') {
        const { runInitFlow } = await import('./flows/init.js');
        await runInitFlow(client, { cwd: process.cwd(), dryRun: false, noScripts: false });
      } else if (choice === 'projects') await runProjectsFlow(client);
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

async function pickConnectionTarget(): Promise<string | null> {
  log.info('Connect once, then manage projects and secrets from this menu.');

  const target = await select({
    message: 'Connect to keynv',
    options: [
      { value: 'cloud', label: 'keynv.dev', hint: 'hosted — fastest way to start' },
      {
        value: 'self-hosted',
        label: 'Self-hosted server',
        hint: 'your own deployment — enter its API URL',
      },
      { value: 'exit', label: 'Exit' },
    ],
  });
  if (isCancel(target) || target === 'exit') return null;
  if (target === 'cloud') {
    log.info(`New to keynv? Create a free account first: ${DEFAULT_WEB_URL}/register`);
    return DEFAULT_SERVER_URL;
  }

  const server = await text({
    message: 'Server API URL',
    placeholder: 'https://api.keynv.example.com',
    validate: (value) => {
      if (!value) return 'Enter a server URL.';
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return 'Use an http:// or https:// URL.';
        }
        return undefined;
      } catch {
        return 'Enter a valid URL.';
      }
    },
  });
  if (isCancel(server)) return null;
  return String(server);
}
