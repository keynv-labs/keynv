import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { table } from '../ui/format.js';

async function findProjectIdByName(client: ApiClient, name: string): Promise<string> {
  const data = await client.request<{ projects: Array<{ id: string; name: string }> }>(
    '/v1/projects',
  );
  const match = data.projects.find((p) => p.name === name);
  if (!match) throw new Error(`unknown project: ${name}`);
  return match.id;
}

export class MemberAddCommand extends Command {
  static override paths = [['member', 'add']];
  static override usage = Command.Usage({
    description: 'Grant a user access to a project at a given role.',
    examples: [['', '$0 member add billing alice@team.com --role developer']],
  });

  project = Option.String();
  email = Option.String();
  role = Option.String('--role', { required: true });

  async execute(): Promise<number> {
    const role = this.role;
    if (!['lead', 'developer', 'reader'].includes(role)) {
      this.context.stderr.write('keynv: --role must be one of lead, developer, reader\n');
      return 1;
    }
    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, this.project);
    await client.request(`/v1/projects/${projectId}/members`, {
      method: 'POST',
      body: { email: this.email, role },
    });
    this.context.stdout.write(`added ${this.email} to ${this.project} as ${role}\n`);
    return 0;
  }
}

export class MemberRemoveCommand extends Command {
  static override paths = [['member', 'remove']];
  static override usage = Command.Usage({ description: 'Revoke project access for a user.' });

  project = Option.String();
  email = Option.String();

  async execute(): Promise<number> {
    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, this.project);
    const members = await client.request<{
      members: Array<{ user_id: string; email: string; role: string }>;
    }>(`/v1/projects/${projectId}/members`);
    const target = members.members.find((m) => m.email === this.email);
    if (!target) {
      this.context.stderr.write(`keynv: ${this.email} is not a member of ${this.project}\n`);
      return 1;
    }
    await client.request(`/v1/projects/${projectId}/members/${target.user_id}`, {
      method: 'DELETE',
    });
    this.context.stdout.write(`removed ${this.email} from ${this.project}\n`);
    return 0;
  }
}

export class MemberListCommand extends Command {
  static override paths = [['member', 'list']];
  static override usage = Command.Usage({ description: 'List members of a project.' });

  project = Option.String();
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    const client = new ApiClient();
    const projectId = await findProjectIdByName(client, this.project);
    const data = await client.request<{
      members: Array<{ user_id: string; email: string; role: string; granted_at: string }>;
    }>(`/v1/projects/${projectId}/members`);
    if (this.json) {
      this.context.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return 0;
    }
    if (data.members.length === 0) {
      this.context.stdout.write('no members\n');
      return 0;
    }
    this.context.stdout.write(
      `${table(
        ['email', 'role', 'granted_at'],
        data.members.map((m) => [m.email, m.role, m.granted_at]),
      )}\n`,
    );
    return 0;
  }
}
