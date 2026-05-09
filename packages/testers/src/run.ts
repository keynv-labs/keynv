import type { ZodError } from 'zod';
import { sanitizeResult } from './sanitize.js';
import type { ResolvedSecret, TestResult, Tester, TesterTarget } from './types.js';
import { DEFAULT_TIMEOUT_MS } from './types.js';

export interface RunArgs {
  tester: Tester;
  secret: ResolvedSecret;
  target: TesterTarget;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`tester timed out after ${ms}ms`)), ms);
    t.unref();
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

/**
 * Validates the target against the tester's schema, invokes test()
 * with a hard timeout, and runs the result through the sanitizer.
 *
 * The runner never touches network state itself — it's a thin
 * orchestration layer so testers stay focused on protocol mechanics.
 */
export async function runTest(args: RunArgs): Promise<TestResult> {
  const start = Date.now();
  const parsed = args.tester.schema.safeParse(args.target);
  if (!parsed.success) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: `invalid target: ${formatZodIssues(parsed.error)}`,
    };
  }
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let result: TestResult;
  try {
    result = await withTimeout(args.tester.test(args.secret, parsed.data), timeoutMs);
  } catch (err) {
    result = {
      ok: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return sanitizeResult(result, args.secret);
}

function formatZodIssues(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
}
