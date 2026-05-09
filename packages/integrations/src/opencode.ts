import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { KEYNV_FILE_DENY_PATTERNS } from './file-deny-list.js';
import { ensureKeynvBlock, removeKeynvBlock } from './fs-utils.js';
import type { InstallOptions, InstallReport, Integration } from './types.js';

// OpenCode's hook/MCP API was not yet stable when Phase 2 shipped. We
// install a deny-list file and document a TODO; richer integration
// will land alongside the OpenCode integration spec doc.
const OPENCODE_IGNORE_REL = '.opencode/.keynv-deny';

export const opencode: Integration = {
  name: 'opencode',
  displayName: 'OpenCode',

  async detect(opts: InstallOptions = {}): Promise<boolean> {
    const cwd = opts.cwd ?? process.cwd();
    return existsSync(join(cwd, '.opencode')) || existsSync(join(homedir(), '.opencode'));
  },

  async install(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, OPENCODE_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'opencode',
        applied: false,
        changes: [{ path, action: 'update' }],
        summary: `[dry-run] would write ${OPENCODE_IGNORE_REL}`,
      };
    }
    const changed = ensureKeynvBlock(path, [...KEYNV_FILE_DENY_PATTERNS]);
    return {
      agent: 'opencode',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed
        ? `wrote ${OPENCODE_IGNORE_REL}; full hook/MCP integration TBD`
        : 'unchanged',
    };
  },

  async uninstall(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, OPENCODE_IGNORE_REL);
    if (opts.dryRun) {
      return {
        agent: 'opencode',
        applied: false,
        changes: [{ path, action: 'update' }],
        summary: `[dry-run] would remove keynv block from ${OPENCODE_IGNORE_REL}`,
      };
    }
    const changed = removeKeynvBlock(path);
    return {
      agent: 'opencode',
      applied: true,
      changes: [{ path, action: changed ? 'update' : 'skip' }],
      summary: changed ? 'removed keynv block' : 'no keynv block found',
    };
  },
};
