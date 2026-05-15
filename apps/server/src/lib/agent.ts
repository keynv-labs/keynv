import type { Context } from 'hono';

/**
 * Identifies the calling agent for audit purposes. Reads the
 * `X-Keynv-Agent` header (set by the CLI as e.g. "cli/0.1.0",
 * "claude-code/1.0.0", "web/0.0.1") and falls back to the
 * User-Agent or "unknown".
 *
 * Trust boundary: this value is client-controlled and MUST NOT be
 * used for authorization decisions. It is stored in audit records
 * for operational visibility (e.g. "which CLI version made this
 * request?") but an attacker can set any value. The authenticated
 * identity comes from the JWT (`actor_user_id`), which is
 * trustworthy. Treat `agent` as an informational hint, not a
 * security principal.
 */
export function readAgent(c: Context): string {
  const explicit = c.req.header('x-keynv-agent');
  if (explicit && explicit.length <= 128) return explicit;
  const ua = c.req.header('user-agent');
  if (ua && ua.length <= 128) return ua;
  return 'unknown';
}
