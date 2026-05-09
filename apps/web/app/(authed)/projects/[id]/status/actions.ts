'use server';

import { z } from 'zod';
import { type ApiError, api } from '@/lib/api';

export interface TestResult {
  ok: boolean;
  latency_ms: number;
  error?: string;
  info?: Record<string, unknown>;
}

export interface TestActionState {
  result?: TestResult;
  error?: string;
}

const Body = z.object({
  project_id: z.string().min(1),
  env: z.string().min(1),
  key: z.string().min(1),
  tester: z.enum(['postgres', 'mysql', 'redis', 'ssh', 'http']),
  // Free-form target — tester schema validates server-side.
  target_json: z.string().min(2),
});

export async function runTestAction(
  _prev: TestActionState,
  formData: FormData,
): Promise<TestActionState> {
  const parsed = Body.safeParse({
    project_id: formData.get('project_id'),
    env: formData.get('env'),
    key: formData.get('key'),
    tester: formData.get('tester'),
    target_json: formData.get('target_json'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; '),
    };
  }
  let target: unknown;
  try {
    target = JSON.parse(parsed.data.target_json);
  } catch {
    return { error: 'Target form produced invalid JSON. Try again.' };
  }
  try {
    const result = await api<TestResult>(
      `/v1/projects/${parsed.data.project_id}/secrets/${parsed.data.env}/${parsed.data.key}/test`,
      {
        method: 'POST',
        body: { tester: parsed.data.tester, target },
      },
    );
    return { result };
  } catch (err) {
    return { error: (err as ApiError).message };
  }
}
