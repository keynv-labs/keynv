'use server';

import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionState, catchApi } from '@/lib/action-result';

export type ProjectActionState = ActionState;

export async function deleteProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const projectId = String(formData.get('project_id') ?? '');
  if (!projectId) return { error: 'Project ID is required.' };

  const result = await catchApi(() =>
    api(`/v1/projects/${projectId}`, { method: 'DELETE' }),
  );
  if (!result.success) return { error: result.error };

  revalidatePath('/projects');
  redirect('/projects');
}
