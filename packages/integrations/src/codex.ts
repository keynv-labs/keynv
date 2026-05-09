import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { KEYNV_FILE_DENY_PATTERNS } from './file-deny-list.js';
import { ensureKeynvBlock, removeKeynvBlock } from './fs-utils.js';
import type { InstallOptions, InstallReport, Integration } from './types.js';

const CODEX_IGNORE_REL = '.codex/.deny';

export const codexCli: Integration = {
  name: 'codex',
  displayName: 'Codex CLI',

  async detect(opts: InstallOptions = {}): Promise<boolean> {
    const cwd = opts.cwd ?? process.cwd();
    return existsSync(join(cwd, '.codex')) || existsSync(join(homedir(), '.codex'));
  },

  async install(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, CODEX_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'codex',
        applied: false,
        changes: [{ path, action: 'update' }],
        summary: `[dry-run] would write ${CODEX_IGNORE_REL}`,
      };
    }
    const changed = ensureKeynvBlock(path, [...KEYNV_FILE_DENY_PATTERNS]);
    return {
      agent: 'codex',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed
        ? `wrote ${CODEX_IGNORE_REL}; consider adding 'alias codex="keynv exec -- codex"' to your shell rc`
        : 'unchanged',
    };
  },

  async uninstall(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, CODEX_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'codex',
        applied: false,
        changes: [{ path, action: 'update' }],
        summary: `[dry-run] would remove keynv block from ${CODEX_IGNORE_REL}`,
      };
    }
    const changed = removeKeynvBlock(path);
    return {
      agent: 'codex',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed ? 'removed keynv block' : 'no keynv block found',
    };
  },
};
