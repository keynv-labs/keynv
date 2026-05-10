import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { KEYNV_FILE_DENY_PATTERNS, gitignoreBlock } from './file-deny-list.js';
import { ensureKeynvBlock, removeKeynvBlock } from './fs-utils.js';
import type { InstallOptions, InstallReport, Integration } from './types.js';

const CURSOR_IGNORE_REL = '.cursorignore';

export const cursor: Integration = {
  name: 'cursor',
  displayName: 'Cursor',

  async detect(opts: InstallOptions = {}): Promise<boolean> {
    const cwd = opts.cwd ?? process.cwd();
    // Cursor stores user-level config under ~/.cursor; project-level
    // marker is .cursor/ or a Cursor-managed file. We accept either.
    return existsSync(join(cwd, '.cursor')) || existsSync(join(cwd, '.cursorrules'));
  },

  async install(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, CURSOR_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'cursor',
        applied: false,
        changes: [
          {
            path,
            action: 'update',
            note: `would add ${KEYNV_FILE_DENY_PATTERNS.length} ignore patterns`,
          },
        ],
        summary: `[dry-run] would write ${path}`,
      };
    }
    const changed = ensureKeynvBlock(path, gitignoreBlock());
    return {
      agent: 'cursor',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed
        ? `wrote ${KEYNV_FILE_DENY_PATTERNS.length} patterns to ${CURSOR_IGNORE_REL}`
        : 'unchanged',
    };
  },

  async uninstall(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, CURSOR_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'cursor',
        applied: false,
        changes: [{ path, action: 'update' }],
        summary: `[dry-run] would remove keynv block from ${CURSOR_IGNORE_REL}`,
      };
    }
    const changed = removeKeynvBlock(path);
    return {
      agent: 'cursor',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed ? 'removed keynv block' : 'no keynv block found',
    };
  },
};
