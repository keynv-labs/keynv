'use server';

import { catchApi, parseOr } from '@/lib/action-result';
import { api } from '@/lib/api';
import { envName, projectId, secretKey, testerName } from '@/lib/schemas';
import { z } from 'zod';

export interface TestResult {
  ok: boolean;
  latency_ms: number;
  error?: string;
  info?: Record<string, unknown>;
}

export type TestActionState = {
  result?: TestResult;
  error?: string;
};

const Body = z.object({
  project_id: projectId,
  env: envName,
  key: secretKey,
  tester: testerName,
  target_json: z.string().min(2),
});

export async function runTestAction(
  _prev: TestActionState,
  formData: FormData,
): Promise<TestActionState> {
  const parsed = parseOr(Body, formData, ['project_id', 'env', 'key', 'tester', 'target_json']);
  if (!parsed.success) return parsed;

  let target: unknown;
  try {
    target = JSON.parse(parsed.data.target_json);
  } catch {
    return { error: 'Target form produced invalid JSON. Try again.' };
  }

  const result = await catchApi(() =>
    api<TestResult>(
      `/v1/projects/${parsed.data.project_id}/secrets/${parsed.data.env}/${parsed.data.key}/test`,
      {
        method: 'POST',
        body: { tester: parsed.data.tester, target },
      },
    ),
  );
  if (!result.success) return { error: result.error };
  return { result: result.data };
}
