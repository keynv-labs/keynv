import { z } from 'zod';
import type { ResolvedSecret, Tester, TestResult } from './types.js';

const Target = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'HEAD']).default('GET'),
  /**
   *  - 'basic'  : secret.value is the password; target.user is the username.
   *  - 'bearer' : secret.value is the token.
   *  - 'header' : secret.value is the value for header `target.header_name`.
   */
  auth: z.enum(['basic', 'bearer', 'header']),
  user: z.string().optional(),
  header_name: z.string().min(1).optional(),
  expect_status_min: z.coerce.number().int().min(100).max(599).default(200),
  expect_status_max: z.coerce.number().int().min(100).max(599).default(299),
});

type HttpTarget = z.infer<typeof Target>;

export const httpTester: Tester<HttpTarget> = {
  type: 'http',
  schema: Target,
  async test(secret: ResolvedSecret, target: HttpTarget): Promise<TestResult> {
    const start = Date.now();
    const headers: Record<string, string> = {};
    switch (target.auth) {
      case 'basic': {
        if (!target.user) return failBadTarget('basic auth requires target.user', start);
        const encoded = Buffer.from(`${target.user}:${secret.value}`).toString('base64');
        headers['authorization'] = `Basic ${encoded}`;
        break;
      }
      case 'bearer':
        headers['authorization'] = `Bearer ${secret.value}`;
        break;
      case 'header': {
        if (!target.header_name) {
          return failBadTarget('header auth requires target.header_name', start);
        }
        headers[target.header_name.toLowerCase()] = secret.value;
        break;
      }
    }

    try {
      const res = await fetch(target.url, {
        method: target.method,
        headers,
        signal: AbortSignal.timeout(5000),
      });
      const ok = res.status >= target.expect_status_min && res.status <= target.expect_status_max;
      return {
        ok,
        latency_ms: Date.now() - start,
        info: { status: res.status },
        ...(ok ? {} : { error: `HTTP ${res.status}` }),
      };
    } catch (err) {
      return {
        ok: false,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

function failBadTarget(message: string, start: number): TestResult {
  return { ok: false, latency_ms: Date.now() - start, error: message };
}
