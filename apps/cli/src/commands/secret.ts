import { reference } from '@keynv/core';
import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { promptNewSecret } from '../ui/flows/secret.js';
import { handleExecError, table } from '../ui/format.js';
import { UserCancelled } from '../ui/helpers/cancel.js';
import { pickProject } from '../ui/helpers/pickProject.js';
import { pickSecret } from '../ui/helpers/pickSecret.js';
import { isInteractive } from '../ui/helpers/tty.js';
import { promptHidden } from '../ui/input.js';
import { ClipboardUnavailableError, copyToClipboard } from '../util/clipboard.js';
import { resolveProjectId } from './project.js';

const ALIAS_FORMAT_HINT =
  'Format: @<project>.<env>.<KEY>  (project/env: lowercase kebab-case; key: letters, digits, _ or -)';

function missingAlias(stderr: NodeJS.WritableStream): number {
  stderr.write('keynv: missing <alias> (TTY required for interactive prompt).\n');
  return 1;
}

async function pickAliasInteractive(client: ApiClient): Promise<string | null> {
  const project = await pickProject(client, 'Project');
  if (!project) return null;
  const secret = await pickSecret(client, project.id, 'Secret');
  if (!secret) return null;
  return secret.alias;
}

export class SecretCreateCommand extends Command {
  static override paths = [['secret', 'create']];
  static override usage = Command.Usage({
    description: 'Create a new secret.',
    examples: [
      [
        'Inline value (avoid in shell history; prefer --stdin)',
        '$0 secret create @billing.dev.db_password --value example-fake-pass-do-not-use',
      ],
      ['From stdin', 'echo -n "..." | $0 secret create @billing.dev.db_password --stdin'],
      ['Interactive (TTY)', '$0 secret create'],
    ],
  });

  alias = Option.String({ required: false });
  value = Option.String('--value', {
    description: 'Secret value (avoid this in shell history; prefer --stdin).',
  });
  stdin = Option.Boolean('--stdin', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      await client.ensureHydrated();

      let alias = this.alias;
      let value = this.value;

      if (!alias) {
        if (!isInteractive()) return missingAlias(this.context.stderr);
        try {
          const built = await promptNewSecret(client);
          if (!built) return 1;
          alias = built.alias;
          value = built.value;
        } catch (err) {
          if (err instanceof UserCancelled) return 130;
          throw err;
        }
      }

      const parsed = reference.parseAlias(alias);
      if (!parsed) {
        this.context.stderr.write(`keynv: invalid alias '${alias}'.\n  ${ALIAS_FORMAT_HINT}\n`);
        return 1;
      }

      if (this.stdin) {
        const chunks: Buffer[] = [];
        for await (const chunk of this.context.stdin) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
        }
        value = Buffer.concat(chunks).toString('utf8').replace(/\n$/, '');
      } else if (value === undefined) {
        value = await promptHidden('value: ');
      }

      const projectId = await resolveProjectId(client, parsed.project);
      await client.request<{ alias: string; version: number }>(
        `/v1/projects/${projectId}/secrets`,
        {
          method: 'POST',
          body: { env: parsed.environment, key: parsed.key, value },
        },
      );
      this.context.stdout.write(`created ${parsed.literal}\n`);
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class SecretGetCommand extends Command {
  static override paths = [['secret', 'get']];
  static override usage = Command.Usage({
    description:
      'Resolve a secret. Prints the value to stdout, or use --copy to put it on the clipboard without printing it.',
  });
  alias = Option.String({ required: false });
  json = Option.Boolean('--json', false);
  copy = Option.Boolean('--copy', false, {
    description:
      'Copy the value to the OS clipboard instead of printing it (never shown in output).',
  });

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      await client.ensureHydrated();

      let alias = this.alias;
      if (!alias) {
        if (!isInteractive()) return missingAlias(this.context.stderr);
        try {
          alias = (await pickAliasInteractive(client)) ?? undefined;
        } catch (err) {
          if (err instanceof UserCancelled) return 130;
          throw err;
        }
        if (!alias) return 1;
      }

      const parsed = reference.parseAlias(alias);
      if (!parsed) {
        this.context.stderr.write(`keynv: invalid alias '${alias}'.\n  ${ALIAS_FORMAT_HINT}\n`);
        return 1;
      }
      const projectId = await resolveProjectId(client, parsed.project);
      const data = await client.request<{ alias: string; value: string; version: number }>(
        `/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}`,
      );
      if (this.copy) {
        // Clipboard path: the value goes to the OS clipboard and is NEVER
        // written to stdout/stderr, so it can't land in an AI transcript,
        // terminal scrollback, or shell log. On failure we error out — we
        // must not silently fall back to printing the secret.
        try {
          await copyToClipboard(data.value);
        } catch (err) {
          if (err instanceof ClipboardUnavailableError) {
            this.context.stderr.write(
              `keynv: ${err.message}.\n       Install one (pbcopy/clip are built in; Linux: wl-clipboard or xclip), or omit --copy to print to stdout.\n`,
            );
            return 1;
          }
          throw err;
        } finally {
          data.value = '';
        }
        this.context.stderr.write(`keynv: copied ${data.alias} (v${data.version}) to clipboard.\n`);
        return 0;
      }
      if (this.json) {
        this.context.stdout.write(
          `${JSON.stringify({ alias: data.alias, version: data.version, value: data.value })}\n`,
        );
      } else {
        this.context.stdout.write(`${data.value}\n`);
      }
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class SecretListCommand extends Command {
  static override paths = [['secret', 'list']];
  static override usage = Command.Usage({
    description: 'List alias names in a project (no values returned).',
  });
  project = Option.String({ required: false });
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      await client.ensureHydrated();

      let projectName = this.project;
      if (!projectName) {
        if (!isInteractive()) {
          this.context.stderr.write('keynv: missing <project>.\n');
          return 1;
        }
        try {
          const picked = await pickProject(client, 'Project');
          if (!picked) return 1;
          projectName = picked.name;
        } catch (err) {
          if (err instanceof UserCancelled) return 130;
          throw err;
        }
      }

      // Allow "@project.env" or "@project.env.KEY" as a shorthand — extract project name.
      let resolvedProjectName = projectName;
      if (projectName.startsWith('@')) {
        const parsed = reference.parseAlias(projectName);
        if (parsed) {
          resolvedProjectName = parsed.project;
        } else {
          // Fallback: strip @ and take first component.
          resolvedProjectName = projectName.slice(1).split('.')[0] ?? projectName;
        }
      }
      const projectId = await resolveProjectId(client, resolvedProjectName);
      const data = await client.request<{
        secrets: Array<{ alias: string; version: number; created_at: string }>;
      }>(`/v1/projects/${projectId}/secrets`);
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
        return 0;
      }
      if (data.secrets.length === 0) {
        this.context.stdout.write('no secrets\n');
        return 0;
      }
      this.context.stdout.write(
        `${table(
          ['alias', 'version', 'created_at'],
          data.secrets.map((s) => [s.alias, String(s.version), s.created_at]),
        )}\n`,
      );
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class SecretRotateCommand extends Command {
  static override paths = [['secret', 'rotate']];
  static override usage = Command.Usage({ description: 'Create a new version of a secret.' });
  alias = Option.String({ required: false });
  value = Option.String('--value');
  stdin = Option.Boolean('--stdin', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      await client.ensureHydrated();

      let alias = this.alias;
      if (!alias) {
        if (!isInteractive()) return missingAlias(this.context.stderr);
        try {
          alias = (await pickAliasInteractive(client)) ?? undefined;
        } catch (err) {
          if (err instanceof UserCancelled) return 130;
          throw err;
        }
        if (!alias) return 1;
      }

      const parsed = reference.parseAlias(alias);
      if (!parsed) {
        this.context.stderr.write(`keynv: invalid alias '${alias}'.\n  ${ALIAS_FORMAT_HINT}\n`);
        return 1;
      }
      let value: string;
      if (this.stdin) {
        const chunks: Buffer[] = [];
        for await (const chunk of this.context.stdin) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
        }
        value = Buffer.concat(chunks).toString('utf8').replace(/\n$/, '');
      } else if (this.value !== undefined) {
        value = this.value;
      } else {
        value = await promptHidden('new value: ');
      }
      const projectId = await resolveProjectId(client, parsed.project);
      const data = await client.request<{ alias: string; version: number }>(
        `/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}/rotate`,
        { method: 'POST', body: { new_value: value } },
      );
      this.context.stdout.write(`rotated ${data.alias} → v${data.version}\n`);
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class SecretDeleteCommand extends Command {
  static override paths = [['secret', 'delete']];
  static override usage = Command.Usage({ description: 'Soft-delete a secret.' });
  alias = Option.String({ required: false });
  force = Option.Boolean('--force', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      await client.ensureHydrated();

      let alias = this.alias;
      if (!alias) {
        if (!isInteractive()) return missingAlias(this.context.stderr);
        try {
          alias = (await pickAliasInteractive(client)) ?? undefined;
        } catch (err) {
          if (err instanceof UserCancelled) return 130;
          throw err;
        }
        if (!alias) return 1;
      }

      const parsed = reference.parseAlias(alias);
      if (!parsed) {
        this.context.stderr.write(`keynv: invalid alias '${alias}'.\n  ${ALIAS_FORMAT_HINT}\n`);
        return 1;
      }

      if (!this.force) {
        if (isInteractive()) {
          const { confirm } = await import('@clack/prompts');
          const ok = await confirm({
            message: `Delete secret ${parsed.literal}?`,
          });
          if (!ok) {
            this.context.stderr.write('Cancelled.\n');
            return 130;
          }
        } else {
          this.context.stderr.write('keynv: refusing to delete without --force\n');
          return 2;
        }
      }

      const projectId = await resolveProjectId(client, parsed.project);
      await client.request(
        `/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}`,
        {
          method: 'DELETE',
        },
      );
      this.context.stdout.write(`deleted ${parsed.literal}\n`);
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class SecretSetRotationCommand extends Command {
  static override paths = [['secret', 'set-rotation']];
  static override usage = Command.Usage({
    description: 'Configure rotation interval for a secret.',
    examples: [['$0 secret set-rotation @billing.dev.db_password --interval 90', '']],
  });
  alias = Option.String({ required: false });
  interval = Option.String('--interval', { required: true });

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      await client.ensureHydrated();

      let alias = this.alias;
      if (!alias) {
        if (!isInteractive()) return missingAlias(this.context.stderr);
        try {
          alias = (await pickAliasInteractive(client)) ?? undefined;
        } catch (err) {
          if (err instanceof UserCancelled) return 130;
          throw err;
        }
        if (!alias) return 1;
      }

      const parsed = reference.parseAlias(alias);
      if (!parsed) {
        this.context.stderr.write(`keynv: invalid alias '${alias}'.\n  ${ALIAS_FORMAT_HINT}\n`);
        return 1;
      }

      const intervalDays = Number(this.interval);
      if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
        this.context.stderr.write('keynv: --interval must be an integer between 1 and 365.\n');
        return 1;
      }

      const projectId = await resolveProjectId(client, parsed.project);
      const data = await client.request<{
        alias: string;
        interval_days: number | null;
        next_rotation_at: string | null;
      }>(`/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}/rotation`, {
        method: 'PATCH',
        body: { interval_days: intervalDays },
      });
      this.context.stdout.write(
        `rotation policy for ${data.alias}: interval=${data.interval_days}d, next=${data.next_rotation_at ?? 'TBD'}\n`,
      );
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class SecretRotationsCommand extends Command {
  static override paths = [['secret', 'rotations']];
  static override usage = Command.Usage({
    description: 'List secrets due for rotation.',
    examples: [
      ['$0 secret rotations --project billing', ''],
      ['$0 secret rotations --project billing --due', ''],
    ],
  });
  project = Option.String('--project', { required: true });
  due = Option.Boolean('--due', false);
  overdue = Option.Boolean('--overdue', false);
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      await client.ensureHydrated();

      const projectId = await resolveProjectId(client, this.project);
      const params = new URLSearchParams();
      if (this.due) params.set('due', 'true');
      if (this.overdue) params.set('overdue', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await client.request<{
        secrets: Array<{
          alias: string;
          version: number;
          rotation_interval_days: number | null;
          rotated_at: string | null;
          next_rotation_at: string | null;
          status: string;
        }>;
      }>(`/v1/projects/${projectId}/secrets/rotations${query}`);

      if (this.json === true) {
        this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
        return 0;
      }

      if (data.secrets.length === 0) {
        this.context.stdout.write('no secrets due for rotation\n');
        return 0;
      }

      for (const s of data.secrets) {
        this.context.stdout.write(
          `${s.alias}  v${s.version}  next=${s.next_rotation_at ?? 'N/A'}  status=${s.status}\n`,
        );
      }
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}
