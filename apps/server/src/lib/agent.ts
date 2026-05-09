import type { Context } from 'hono';

/**
 * Identifies the calling agent for audit purposes. Reads the
 * `X-Keynv-Agent` header (set by the CLI as e.g. "cli/0.1.0",
 * "claude-code/1.0.0", "web/0.0.1") and falls back to the
 * User-Agent or "unknown".
 */
export function readAgent(c: Context): string {
  const explicit = c.req.header('x-keynv-agent');
  if (explicit && explicit.length <= 128) return explicit;
  const ua = c.req.header('user-agent');
  if (ua && ua.length <= 128) return ua;
  return 'unknown';
}
