import { toast } from 'sonner';

/**
 * Semantic toast wrapper. Centralised so we can swap the underlying
 * library or restyle without grepping every call site, and so we can
 * enforce a secret-scrubbing pass on every message that hits the UI.
 *
 * Why scrub? Toast bodies are typically error strings from API
 * responses, server actions, or driver errors. A misconfigured route
 * could surface an Authorization header, an SQL error containing a
 * connection string, etc. The scrubber catches the obvious patterns
 * as defence-in-depth — the real fix is to sanitize at the source
 * (pino redactor on the server, error.message guards on the client).
 */

const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'resend', re: /\bre_[A-Za-z0-9_-]{20,}\b/g },
  { name: 'openai_or_anthropic', re: /\bsk-(?:ant-|proj-|live_)?[A-Za-z0-9_-]{20,}\b/g },
  { name: 'github_pat', re: /\b(?:ghp|ghs|gho|ghu|ghr)_[A-Za-z0-9]{20,}\b/g },
  { name: 'google_api', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'slack', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: 'pem', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'keynv_alias', re: /@[\w.-]+\.[\w.-]+\.[\w.-]+\s*=\s*[^\s)]+/g },
];

export function scrubToastMessage(message: string): string {
  let scrubbed = message;
  const hits: string[] = [];
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(scrubbed)) {
      hits.push(name);
      scrubbed = scrubbed.replace(re, '[redacted]');
    }
  }
  if (hits.length > 0 && typeof console !== 'undefined') {
    console.warn(
      `[keynv:toast] scrubbed secret-shaped content from toast (${hits.join(', ')}); fix the upstream source`,
    );
  }
  return scrubbed;
}

export interface NotifyOpts {
  description?: string;
  duration?: number;
  id?: string | number;
}

function publish(
  level: 'success' | 'error' | 'info',
  message: string,
  opts?: NotifyOpts,
): string | number {
  const safeMessage = scrubToastMessage(message);
  const safeOpts = opts?.description
    ? { ...opts, description: scrubToastMessage(opts.description) }
    : opts;
  return toast[level](safeMessage, safeOpts);
}

export const notify = {
  success: (message: string, opts?: NotifyOpts) => publish('success', message, opts),
  error: (message: string, opts?: NotifyOpts) => publish('error', message, opts),
  info: (message: string, opts?: NotifyOpts) => publish('info', message, opts),
  dismiss: (id?: string | number) => toast.dismiss(id),
};
