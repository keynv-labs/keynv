'use server';

import { api } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function deleteProjectAction(formData: FormData): Promise<never> {
  const projectId = String(formData.get('project_id') ?? '');
  if (!projectId) throw new Error('project_id required');

  await api(`/v1/projects/${projectId}`, { method: 'DELETE' });
  revalidatePath('/projects');
  redirect('/projects');
}
