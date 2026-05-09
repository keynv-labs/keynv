import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { table } from '../ui/format.js';

interface ProjectListItem {
  id: string;
  name: string;
  created_at: string;
}

export class ProjectListCommand extends Command {
  static override paths = [['project', 'list']];
  static override usage = Command.Usage({
    description: 'List projects visible to the current user.',
  });
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    const client = new ApiClient();
    const data = await client.request<{ projects: ProjectListItem[] }>('/v1/projects');
    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return 0;
    }
    if (data.projects.length === 0) {
      this.context.stdout.write('no projects\n');
      return 0;
    }
    this.context.stdout.write(
      `${table(
        ['name', 'id', 'created_at'],
        data.projects.map((p) => [p.name, p.id, p.created_at]),
      )}\n`,
    );
    return 0;
  }
}

export class ProjectCreateCommand extends Command {
  static override paths = [['project', 'create']];
  static override usage = Command.Usage({
    description: 'Create a new project with one or more environments.',
    examples: [['Two envs', '$0 project create billing --env dev --env prod:production:approval']],
  });

  name = Option.String();
  envs = Option.Array('--env', {
    description:
      'Environment spec: name[:tier[:approval]]. Tier ∈ {production,non-production}; "approval" sets require_approval=true.',
  });

  async execute(): Promise<number> {
    const envs = (this.envs ?? ['dev']).map((spec) => {
      const [name, tier, approval] = spec.split(':');
      return {
        name: name ?? '',
        tier: (tier as 'production' | 'non-production' | undefined) ?? 'non-production',
        require_approval: approval === 'approval',
      };
    });
    const client = new ApiClient();
    const result = await client.request<{ id: string; name: string }>('/v1/projects', {
      method: 'POST',
      body: { name: this.name, environments: envs },
    });
    this.context.stdout.write(`created project ${result.name} (${result.id})\n`);
    for (const e of envs) {
      this.context.stdout.write(
        `  env: ${e.name} (tier=${e.tier}, approval=${e.require_approval})\n`,
      );
    }
    return 0;
  }
}

export class ProjectDescribeCommand extends Command {
  static override paths = [['project', 'describe']];
  static override usage = Command.Usage({ description: 'Show metadata for one project.' });
  id = Option.String();
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    const client = new ApiClient();
    const data = await client.request<{
      id: string;
      name: string;
      environments: Array<{ name: string; tier: string; require_approval: boolean }>;
    }>(`/v1/projects/${this.id}`);
    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return 0;
    }
    this.context.stdout.write(`project: ${data.name} (${data.id})\n`);
    for (const e of data.environments) {
      this.context.stdout.write(
        `  env: ${e.name} (tier=${e.tier}, approval=${e.require_approval})\n`,
      );
    }
    return 0;
  }
}

export class ProjectDeleteCommand extends Command {
  static override paths = [['project', 'delete']];
  static override usage = Command.Usage({ description: 'Soft-delete a project.' });
  id = Option.String();
  force = Option.Boolean('--force', false);

  async execute(): Promise<number> {
    if (!this.force) {
      this.context.stderr.write('keynv: refusing to delete without --force\n');
      return 2;
    }
    const client = new ApiClient();
    await client.request(`/v1/projects/${this.id}`, { method: 'DELETE' });
    this.context.stdout.write(`deleted project ${this.id}\n`);
    return 0;
  }
}
