import { confirm, group, log, multiselect, note, select, text } from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';
import { UserCancelled, unwrap } from '../helpers/cancel.js';
import { describeProject } from '../helpers/pickEnv.js';
import { type ProjectSummary, listProjects } from '../helpers/pickProject.js';
import { runMembersFlow } from './member.js';
import { runSecretsFlow } from './secret.js';

interface ProjectDetail {
  id: string;
  name: string;
  environments: Array<{ name: string; tier: string; require_approval: boolean }>;
}

interface EnvSpec {
  name: string;
  tier: 'production' | 'non-production';
  require_approval: boolean;
}

export async function runProjectsFlow(client: ApiClient): Promise<void> {
  while (true) {
    const projects = await listProjects(client);
    const choices = [
      ...projects.map((p) => ({ value: p.id, label: p.name, hint: p.id })),
      { value: '__new', label: '+ New project' } as const,
      { value: '__back', label: '← Back' } as const,
    ];
    const choice = unwrap(
      await select({
        message: projects.length === 0 ? 'No projects yet' : 'Pick a project',
        options: choices,
      }),
    );
    if (choice === '__back') return;
    if (choice === '__new') {
      await createProjectInteractive(client);
      continue;
    }
    const selected = projects.find((p) => p.id === choice);
    if (!selected) continue;
    await runProjectMenu(client, selected);
  }
}

async function runProjectMenu(client: ApiClient, project: ProjectSummary): Promise<void> {
  while (true) {
    const detail = await describeProject(client, project.id).catch(() => null);
    const envCount = detail?.environments.length ?? 0;
    const choice = unwrap(
      await select({
        message: `${project.name}  (${envCount} env${envCount === 1 ? '' : 's'})`,
        options: [
          { value: 'secrets', label: 'View / edit secrets' },
          { value: 'members', label: 'Manage members' },
          { value: 'describe', label: 'Show details' },
          { value: 'delete', label: 'Delete project' },
          { value: 'back', label: '← Back' },
        ],
      }),
    );
    if (choice === 'back') return;
    if (choice === 'secrets') {
      await runSecretsFlow(client, project);
    } else if (choice === 'members') {
      await runMembersFlow(client, project);
    } else if (choice === 'describe') {
      printDetail(detail);
    } else if (choice === 'delete') {
      const confirmed = unwrap(
        await confirm({ message: `Delete ${project.name}? (soft delete)`, initialValue: false }),
      );
      if (!confirmed) continue;
      await client.request(`/v1/projects/${project.id}`, { method: 'DELETE' });
      log.success(`Deleted ${project.name}`);
      return;
    }
  }
}

function printDetail(detail: ProjectDetail | null): void {
  if (!detail) {
    log.warn('Could not load project details.');
    return;
  }
  const envLines = detail.environments.map(
    (e) => `  ${e.name}  (tier=${e.tier}, approval=${e.require_approval})`,
  );
  note(
    `${detail.name}  (${detail.id})\n${envLines.join('\n') || '  (no environments)'}`,
    'Project',
  );
}

export async function createProjectInteractive(client: ApiClient): Promise<ProjectSummary | null> {
  const answers = await group(
    {
      name: () =>
        text({
          message: 'Project name',
          validate: (v) =>
            v && /^[a-z0-9][a-z0-9-]{0,47}$/.test(v)
              ? undefined
              : 'lowercase, digits, dashes; up to 48 chars; must start with letter/digit',
        }),
      envs: () =>
        multiselect({
          message: 'Which environments?',
          options: [
            { value: 'dev', label: 'dev' },
            { value: 'staging', label: 'staging' },
            { value: 'prod', label: 'prod', hint: 'production tier + approval' },
          ],
          initialValues: ['dev'],
          required: true,
        }),
    },
    {
      onCancel: () => {
        throw new UserCancelled();
      },
    },
  );

  const envs: EnvSpec[] = (answers.envs as string[]).map((name) => {
    if (name === 'prod') {
      return { name, tier: 'production', require_approval: true };
    }
    return { name, tier: 'non-production', require_approval: false };
  });

  const created = await client.request<{ id: string; name: string }>('/v1/projects', {
    method: 'POST',
    body: { name: answers.name, environments: envs },
  });
  log.success(`Created ${created.name} (${created.id})`);
  return { id: created.id, name: created.name };
}
