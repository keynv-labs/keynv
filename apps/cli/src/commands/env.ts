import { Command, Option } from 'clipanion';
import { requireServerFeature } from '../client/compat.js';
import { ApiClient } from '../client/http.js';
import { handleExecError, table } from '../ui/format.js';
import { resolveProjectId } from './project.js';

export type EnvironmentTier = 'production' | 'non-production';

interface ProjectEnvironment {
  id: string;
  name: string;
  tier: EnvironmentTier;
  require_approval: boolean;
}

interface ProjectDetailResponse {
  id: string;
  name: string;
  environments: ProjectEnvironment[];
}

export function parseEnvironmentTier(value: string): EnvironmentTier | null {
  if (value === 'production' || value === 'non-production') return value;
  return null;
}

export class EnvListCommand extends Command {
  static override paths = [['env', 'list']];
  static override usage = Command.Usage({
    description: 'List environments for a project.',
    examples: [['By project name', '$0 env list --project billing']],
  });

  project = Option.String('--project', { required: true });
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      const client = new ApiClient();
      const projectId = await resolveProjectId(client, this.project);
      const data = await client.request<ProjectDetailResponse>(`/v1/projects/${projectId}`);
      if (this.json) {
        this.context.stdout.write(
          `${JSON.stringify({ environments: data.environments }, null, 2)}\n`,
        );
        return 0;
      }
      if (data.environments.length === 0) {
        this.context.stdout.write('no environments\n');
        return 0;
      }
      this.context.stdout.write(
        `${table(
          ['name', 'tier', 'approval', 'id'],
          data.environments.map((env) => [
            env.name,
            env.tier,
            String(env.require_approval),
            env.id,
          ]),
        )}\n`,
      );
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class EnvAddCommand extends Command {
  static override paths = [['env', 'add']];
  static override usage = Command.Usage({
    description: 'Add an environment to an existing project.',
    examples: [
      [
        'Production env with approval',
        '$0 env add --project billing prod --tier production --approval',
      ],
    ],
  });

  project = Option.String('--project', { required: true });
  name = Option.String();
  tier = Option.String('--tier');
  approval = Option.Boolean('--approval', false);

  async execute(): Promise<number> {
    const tier = parseEnvironmentTier(this.tier ?? 'non-production');
    if (tier === null) {
      this.context.stderr.write('keynv: --tier must be one of production, non-production\n');
      return 1;
    }

    try {
      const client = new ApiClient();
      await requireServerFeature(client, 'environment_management', 'add environments');
      const projectId = await resolveProjectId(client, this.project);
      const result = await client.request<ProjectEnvironment>(
        `/v1/projects/${projectId}/environments`,
        {
          method: 'POST',
          body: {
            name: this.name,
            tier,
            require_approval: this.approval,
          },
        },
      );
      this.context.stdout.write(
        `created env ${result.name} (tier=${result.tier}, approval=${result.require_approval})\n`,
      );
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}
