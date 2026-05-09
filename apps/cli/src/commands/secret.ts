import { parseAlias } from '@keynv/core';
import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { table } from '../ui/format.js';
import { promptHidden } from '../ui/input.js';

interface ProjectListItem {
  id: string;
  name: string;
}

async function findProjectIdByName(client: ApiClient, name: string): Promise<string> {
  const data = await client.request<{ projects: ProjectListItem[] }>('/v1/projects');
  const match = data.projects.find((p) => p.name === name);
  if (!match) throw new Error(`unknown project: ${name}`);
  return match.id;
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
    ],
  });

  alias = Option.String();
  value = Option.String('--value', {
    description: 'Secret value (avoid this in shell history; prefer --stdin).',
  });
  stdin = Option.Boolean('--stdin', false);

  async execute(): Promise<number> {
    const parsed = parseAlias(this.alias);
    if (!parsed) {
      this.context.stderr.write(
        `keynv: invalid alias '${this.alias}'. Expected @project.env.key.\n`,
      );
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
      value = await promptHidden('value: ');
    }

    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, parsed.project);
    await client.request<{ alias: string; version: number }>(`/v1/projects/${projectId}/secrets`, {
      method: 'POST',
      body: { env: parsed.environment, key: parsed.key, value },
    });
    this.context.stdout.write(`created ${parsed.literal}\n`);
    return 0;
  }
}

export class SecretGetCommand extends Command {
  static override paths = [['secret', 'get']];
  static override usage = Command.Usage({
    description: 'Resolve a secret. The value is printed to stdout; nothing else.',
  });
  alias = Option.String();
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    const parsed = parseAlias(this.alias);
    if (!parsed) {
      this.context.stderr.write(`keynv: invalid alias '${this.alias}'.\n`);
      return 1;
    }
    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, parsed.project);
    const data = await client.request<{ alias: string; value: string; version: number }>(
      `/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}`,
    );
    if (this.json) {
      this.context.stdout.write(
        `${JSON.stringify({ alias: data.alias, version: data.version, value: data.value })}\n`,
      );
    } else {
      this.context.stdout.write(`${data.value}\n`);
    }
    return 0;
  }
}

export class SecretListCommand extends Command {
  static override paths = [['secret', 'list']];
  static override usage = Command.Usage({
    description: 'List alias names in a project (no values returned).',
  });
  project = Option.String();
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, this.project);
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
  }
}

export class SecretRotateCommand extends Command {
  static override paths = [['secret', 'rotate']];
  static override usage = Command.Usage({ description: 'Create a new version of a secret.' });
  alias = Option.String();
  value = Option.String('--value');
  stdin = Option.Boolean('--stdin', false);

  async execute(): Promise<number> {
    const parsed = parseAlias(this.alias);
    if (!parsed) {
      this.context.stderr.write(`keynv: invalid alias '${this.alias}'.\n`);
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
    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, parsed.project);
    const data = await client.request<{ alias: string; version: number }>(
      `/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}/rotate`,
      { method: 'POST', body: { new_value: value } },
    );
    this.context.stdout.write(`rotated ${data.alias} → v${data.version}\n`);
    return 0;
  }
}

export class SecretDeleteCommand extends Command {
  static override paths = [['secret', 'delete']];
  static override usage = Command.Usage({ description: 'Soft-delete a secret.' });
  alias = Option.String();

  async execute(): Promise<number> {
    const parsed = parseAlias(this.alias);
    if (!parsed) {
      this.context.stderr.write(`keynv: invalid alias '${this.alias}'.\n`);
      return 1;
    }
    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, parsed.project);
    await client.request(`/v1/projects/${projectId}/secrets/${parsed.environment}/${parsed.key}`, {
      method: 'DELETE',
    });
    this.context.stdout.write(`deleted ${parsed.literal}\n`);
    return 0;
  }
}
