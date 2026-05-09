import { redact } from '@keynv/redactor';
import type { ResolvedSecret, TestResult } from './types.js';

/**
 * Final defense before returning a TestResult to the caller. Even
 * with per-tester sanitization, driver errors sometimes embed
 * connection strings or tokens. This pass:
 *
 *  1. Replaces the resolved value with `<redacted>` if it shows up
 *     literally.
 *  2. Replaces any auxiliary fields (e.g., usernames passed by the
 *     caller as part of `secret.fields`) the same way.
 *  3. Runs the redactor pattern bank over the error string.
 */
export function sanitizeResult(result: TestResult, secret: ResolvedSecret): TestResult {
  if (!result.error) return result;

  let cleaned = result.error;
  if (secret.value.length > 0) {
    cleaned = cleaned.split(secret.value).join('<redacted>');
  }
  if (secret.fields) {
    for (const v of Object.values(secret.fields)) {
      if (v && v.length > 0) cleaned = cleaned.split(v).join('<redacted>');
    }
  }
  cleaned = redact(cleaned).text;

  return { ...result, error: cleaned };
}
