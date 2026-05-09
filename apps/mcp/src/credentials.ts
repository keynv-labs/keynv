/**
 * Reads ~/.keynv/credentials.json (same file the CLI writes after
 * `keynv login`). The MCP server inherits the developer's session;
 * agents calling MCP tools act as the developer.
 *
 * Keeping a separate identity for the agent (so audits clearly tag
 * the agent vs the human) is a Phase 6 commercial feature.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Credentials {
  server_url: string;
  user_id: string;
  email: string;
  org_id: string;
  org_role: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
}

export function loadCredentials(): Credentials | null {
  const path = process.env['KEYNV_CREDENTIALS_FILE'] ?? join(homedir(), '.keynv', 'credentials.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Credentials;
  } catch {
    return null;
  }
}
