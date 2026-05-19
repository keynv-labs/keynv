import { homedir, platform } from 'node:os';
import { join } from 'node:path';

/**
 * Platform-aware default surface locations. Centralised so tests can
 * stub via env vars (`KEYNV_TS_HOME` overrides $HOME for the scanner).
 *
 * No path is read here — these are just resolved strings. A surface
 * decides whether the path is present.
 */

export function keynvHome(): string {
  return process.env.KEYNV_TS_HOME ?? homedir();
}

export function zshHistoryPath(): string {
  // Respect $HISTFILE if set; otherwise the zsh default.
  const explicit = process.env.HISTFILE;
  if (explicit && explicit.length > 0) return explicit;
  return join(keynvHome(), '.zsh_history');
}

export function bashHistoryPath(): string {
  // Bash also honours $HISTFILE, but it shares the env var with zsh.
  // We only treat $HISTFILE as bash's if SHELL points at bash.
  const shell = process.env.SHELL ?? '';
  const explicit = process.env.HISTFILE;
  if (explicit && explicit.length > 0 && /bash/i.test(shell)) return explicit;
  return join(keynvHome(), '.bash_history');
}

export function fishHistoryPath(): string {
  return join(keynvHome(), '.local', 'share', 'fish', 'fish_history');
}

export function claudeCodeProjectsDir(): string {
  return join(keynvHome(), '.claude', 'projects');
}

export function cursorLogsDir(): string {
  switch (platform()) {
    case 'darwin':
      return join(keynvHome(), 'Library', 'Application Support', 'Cursor', 'logs');
    case 'win32':
      return join(process.env.APPDATA ?? join(keynvHome(), 'AppData', 'Roaming'), 'Cursor', 'logs');
    default:
      return join(keynvHome(), '.config', 'Cursor', 'logs');
  }
}
