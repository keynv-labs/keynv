import { spawn } from 'node:child_process';
import { confirm, group, log, note, password, select, text } from '@clack/prompts';
import { reference } from '@keynv/core';
import type { ApiClient } from '../../client/http.js';
import { UserCancelled, unwrap } from '../helpers/cancel.js';
import { pickEnv } from '../helpers/pickEnv.js';
import { type ProjectSummary, pickProject } from '../helpers/pickProject.js';
import { listSecrets } from '../helpers/pickSecret.js';

export async function runSecretsFlow(client: ApiClient, project?: ProjectSummary): Promise<void> {
  let target = project;
  if (!target) {
    const picked = await pickProject(client, 'Project to manage secrets in');
    if (!picked) return;
    target = picked;
  }

  while (true) {
    const secrets = await listSecrets(client, target.id);
    const choice = unwrap(
      await select({
        message:
          secrets.length === 0
            ? `No secrets in ${target.name} yet`
            : `${target.name}  (${secrets.length} secret${secrets.length === 1 ? '' : 's'})`,
        options: [
          ...secrets.map((s) => ({ value: s.alias, label: s.alias, hint: `v${s.version}` })),
          { value: '__new', label: '+ New secret' },
          { value: '__back', label: '← Back' },
        ],
      }),
    );
    if (choice === '__back') return;
    if (choice === '__new') {
      await createSecretInteractive(client, target);
      continue;
    }
    await runSecretMenu(client, target, choice);
  }
}

async function runSecretMenu(
  client: ApiClient,
  project: ProjectSummary,
  alias: string,
): Promise<void> {
  while (true) {
    const choice = unwrap(
      await select({
        message: alias,
        options: [
          { value: 'copy', label: 'Copy value to clipboard' },
          { value: 'reveal', label: 'Reveal once (prints to terminal)' },
          { value: 'rotate', label: 'Rotate value' },
          { value: 'delete', label: 'Delete' },
          { value: 'back', label: '← Back' },
        ],
      }),
    );
    const parsed = reference.parseAlias(alias);
    if (!parsed) {
      log.warn(`unparseable alias: ${alias}`);
      return;
    }
    const path = `/v1/projects/${project.id}/secrets/${parsed.environment}/${parsed.key}`;
    if (choice === 'back') return;
    if (choice === 'copy' || choice === 'reveal') {
      const data = await client.request<{ value: string; version: number }>(path);
      if (choice === 'copy') {
        const ok = await copyToClipboard(data.value);
        if (ok) log.success(`Copied ${alias} (v${data.version}) to clipboard`);
        else {
          log.warn('Clipboard unavailable; revealing instead.');
          note(data.value, alias);
        }
      } else {
        note(data.value, `${alias}  (v${data.version})`);
        log.warn('Value is now in your terminal scrollback. Clear with `clear` if needed.');
      }
    } else if (choice === 'rotate') {
      const newValue = unwrap(
        await password({
          message: 'New value',
          validate: (v) => (v?.length ? undefined : 'required'),
        }),
      );
      const data = await client.request<{ alias: string; version: number }>(`${path}/rotate`, {
        method: 'POST',
        body: { new_value: newValue },
      });
      log.success(`Rotated ${data.alias} → v${data.version}`);
    } else if (choice === 'delete') {
      const confirmed = unwrap(await confirm({ message: `Delete ${alias}?`, initialValue: false }));
      if (!confirmed) continue;
      await client.request(path, { method: 'DELETE' });
      log.success(`Deleted ${alias}`);
      return;
    }
  }
}

async function copyToClipboard(value: string): Promise<boolean> {
  const platform = process.platform;
  const cmd =
    platform === 'darwin'
      ? ['pbcopy', []]
      : platform === 'win32'
        ? ['clip', []]
        : ['xclip', ['-selection', 'clipboard']];
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd[0] as string, cmd[1] as string[], {
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
      child.stdin.end(value);
    } catch {
      resolve(false);
    }
  });
}

export interface NewSecretInput {
  alias: string;
  value: string;
}

/**
 * Interactive form to assemble a new secret. Reused by SecretCreateCommand
 * when invoked without an alias on a TTY.
 */
export async function promptNewSecret(
  client: ApiClient,
  project?: ProjectSummary,
): Promise<NewSecretInput | null> {
  let target = project;
  if (!target) {
    const picked = await pickProject(client, 'Project');
    if (!picked) return null;
    target = picked;
  }
  const env = await pickEnv(client, target.id, 'Environment');
  if (!env) return null;

  const answers = await group(
    {
      key: () =>
        text({
          message: 'Key name',
          placeholder: 'api_key',
          validate: (v) =>
            v && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(v)
              ? undefined
              : 'lowercase, digits, _ or -; up to 64 chars',
        }),
      value: () =>
        password({
          message: 'Value (hidden)',
          validate: (v) => (v?.length ? undefined : 'required'),
        }),
    },
    {
      onCancel: () => {
        throw new UserCancelled();
      },
    },
  );

  const built = reference.buildAlias({ project: target.name, environment: env, key: answers.key });
  if (!built) return null;
  return { alias: built.literal, value: answers.value };
}

async function createSecretInteractive(client: ApiClient, project: ProjectSummary): Promise<void> {
  const built = await promptNewSecret(client, project);
  if (!built) return;
  const parsed = reference.parseAlias(built.alias);
  if (!parsed) {
    log.warn('Invalid alias produced by form; aborting.');
    return;
  }
  await client.request(`/v1/projects/${project.id}/secrets`, {
    method: 'POST',
    body: { env: parsed.environment, key: parsed.key, value: built.value },
  });
  log.success(`Created ${built.alias}`);
}
