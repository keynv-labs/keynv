import { confirm, group, log, note, select, text } from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';
import { UserCancelled, unwrap } from '../helpers/cancel.js';
import { type ProjectSummary, pickProject } from '../helpers/pickProject.js';

interface Member {
  user_id: string;
  email: string;
  role: string;
  granted_at?: string;
}

async function listMembers(client: ApiClient, projectId: string): Promise<Member[]> {
  const data = await client.request<{ members: Member[] }>(`/v1/projects/${projectId}/members`);
  return data.members;
}

export async function runMembersFlow(client: ApiClient, project?: ProjectSummary): Promise<void> {
  let target = project;
  if (!target) {
    const picked = await pickProject(client, 'Project');
    if (!picked) return;
    target = picked;
  }

  while (true) {
    const members = await listMembers(client, target.id);
    const lines = members.length
      ? members.map((m) => `  ${m.email}  (${m.role})`).join('\n')
      : '  (no members)';
    note(`${target.name}\n${lines}`, 'Members');

    const choice = unwrap(
      await select({
        message: 'Action',
        options: [
          { value: 'add', label: '+ Add member' },
          ...(members.length
            ? [{ value: 'remove' as const, label: '- Remove member' }]
            : []),
          { value: 'back' as const, label: '← Back' },
        ],
      }),
    );
    if (choice === 'back') return;
    if (choice === 'add') {
      await addMemberInteractive(client, target);
    } else if (choice === 'remove') {
      const value = unwrap(
        await select({
          message: 'Remove which member?',
          options: members.map((m) => ({ value: m.user_id, label: `${m.email} (${m.role})` })),
        }),
      );
      const member = members.find((m) => m.user_id === value);
      if (!member) continue;
      const confirmed = unwrap(
        await confirm({ message: `Remove ${member.email}?`, initialValue: false }),
      );
      if (!confirmed) continue;
      await client.request(`/v1/projects/${target.id}/members/${member.user_id}`, {
        method: 'DELETE',
      });
      log.success(`Removed ${member.email}`);
    }
  }
}

async function addMemberInteractive(client: ApiClient, project: ProjectSummary): Promise<void> {
  const answers = await group(
    {
      email: () =>
        text({
          message: 'Email',
          validate: (v) => (v && v.includes('@') ? undefined : 'enter an email'),
        }),
      role: () =>
        select<string>({
          message: 'Role',
          options: [
            { value: 'lead', label: 'lead' },
            { value: 'developer', label: 'developer' },
            { value: 'reader', label: 'reader' },
          ],
          initialValue: 'developer',
        }),
    },
    {
      onCancel: () => {
        throw new UserCancelled();
      },
    },
  );

  await client.request(`/v1/projects/${project.id}/members`, {
    method: 'POST',
    body: { email: answers.email, role: answers.role },
  });
  log.success(`Added ${answers.email} as ${answers.role}`);
}
