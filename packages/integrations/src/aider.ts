import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { KEYNV_FILE_DENY_PATTERNS } from './file-deny-list.js';
import { ensureKeynvBlock, removeKeynvBlock } from './fs-utils.js';
import type { InstallOptions, InstallReport, Integration } from './types.js';

const AIDER_IGNORE_REL = '.aiderignore';

export const aider: Integration = {
  name: 'aider',
  displayName: 'Aider',

  async detect(opts: InstallOptions = {}): Promise<boolean> {
    const cwd = opts.cwd ?? process.cwd();
    return (
      existsSync(join(cwd, AIDER_IGNORE_REL)) ||
      existsSync(join(cwd, '.aider.conf.yml')) ||
      existsSync(join(homedir(), '.aider.conf.yml'))
    );
  },

  async install(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, AIDER_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'aider',
        applied: false,
        changes: [{ path, action: 'update' }],
        summary: `[dry-run] would write ${path}`,
      };
    }
    const changed = ensureKeynvBlock(path, [...KEYNV_FILE_DENY_PATTERNS]);
    return {
      agent: 'aider',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed
        ? `wrote ${KEYNV_FILE_DENY_PATTERNS.length} patterns to ${AIDER_IGNORE_REL}`
        : 'unchanged',
    };
  },

  async uninstall(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, AIDER_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'aider',
        applied: false,
        changes: [{ path, action: 'update' }],
        summary: `[dry-run] would remove keynv block from ${AIDER_IGNORE_REL}`,
      };
    }
    const changed = removeKeynvBlock(path);
    return {
      agent: 'aider',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed ? 'removed keynv block' : 'no keynv block found',
    };
  },
};
