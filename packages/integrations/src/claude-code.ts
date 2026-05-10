import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { KEYNV_FILE_ALLOW_PATTERNS, KEYNV_FILE_DENY_PATTERNS } from './file-deny-list.js';
import { readJsonOrEmpty, writeJson } from './fs-utils.js';
import type { FileChange, InstallOptions, InstallReport, Integration } from './types.js';

const SETTINGS_PATH_REL = '.claude/settings.local.json';
const KEYNV_DENY_TAG = '__keynv_managed__';

interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  hooks?: Record<
    string,
    Array<{ matcher?: string; hooks?: Array<{ type: string; command: string }> }>
  >;
  /** keynv writes a marker so we can locate our entries on uninstall. */
  [KEYNV_DENY_TAG]?: {
    deny_added: string[];
    allow_added: string[];
    hook_added: boolean;
  };
  [k: string]: unknown;
}

function denyEntriesForReadTool(): string[] {
  return KEYNV_FILE_DENY_PATTERNS.map((p) => `Read(${p})`);
}

function allowEntriesForReadTool(): string[] {
  return KEYNV_FILE_ALLOW_PATTERNS.map((p) => `Read(${p})`);
}

export const claudeCode: Integration = {
  name: 'claude-code',
  displayName: 'Claude Code',

  async detect(opts: InstallOptions = {}): Promise<boolean> {
    const cwd = opts.cwd ?? process.cwd();
    return existsSync(join(cwd, '.claude'));
  },

  async install(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, SETTINGS_PATH_REL);
    const settings = readJsonOrEmpty(path) as ClaudeSettings;

    const denyToAdd = denyEntriesForReadTool();
    const allowToAdd = allowEntriesForReadTool();
    const existingDeny = new Set(settings.permissions?.deny ?? []);
    const existingAllow = new Set(settings.permissions?.allow ?? []);
    const newlyAdded: string[] = [];
    for (const entry of denyToAdd) {
      if (!existingDeny.has(entry)) {
        existingDeny.add(entry);
        newlyAdded.push(entry);
      }
    }
    for (const entry of allowToAdd) {
      if (!existingAllow.has(entry)) {
        existingAllow.add(entry);
      }
    }

    settings.permissions = {
      ...settings.permissions,
      allow: [...existingAllow].sort((a, b) => a.localeCompare(b)),
      deny: [...existingDeny].sort((a, b) => a.localeCompare(b)),
    };

    // PostToolUse hook on Bash to redact bash output before Claude reads it.
    settings.hooks = settings.hooks ?? {};
    const post = settings.hooks['PostToolUse'] ?? [];
    const alreadyHooked = post.some((entry) =>
      (entry.hooks ?? []).some((h) => h.command?.includes('keynv redact-stream')),
    );
    if (!alreadyHooked) {
      post.push({
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'keynv redact-stream' }],
      });
      settings.hooks['PostToolUse'] = post;
    }

    // Track the full keynv-managed deny set (not just newly added) so
    // re-installs are idempotent. On uninstall we remove this set;
    // users who want to keep specific patterns can re-add them.
    settings[KEYNV_DENY_TAG] = {
      deny_added: denyToAdd,
      allow_added: allowToAdd,
      hook_added: true,
    };

    const changes: FileChange[] = [];
    if (opts.dryRun) {
      changes.push({
        path,
        action: existsSync(path) ? 'update' : 'create',
        note: `would add ${newlyAdded.length} deny entries${alreadyHooked ? '' : ' + PostToolUse(Bash) → keynv redact-stream'}`,
      });
    } else {
      writeJson(path, settings);
      changes.push({
        path,
        action: existsSync(path) ? 'update' : 'create',
        note: `${newlyAdded.length} new deny entries${alreadyHooked ? '' : ' + redact hook'}`,
      });
    }

    return {
      agent: 'claude-code',
      applied: !opts.dryRun,
      changes,
      summary: opts.dryRun
        ? `[dry-run] ${path}: would add ${newlyAdded.length} permission denies + redact hook`
        : `installed: ${newlyAdded.length} new denies; redact hook ${alreadyHooked ? 'kept' : 'added'}.`,
    };
  },

  async uninstall(opts: InstallOptions = {}): Promise<InstallReport> {
    const cwd = opts.cwd ?? process.cwd();
    const path = join(cwd, SETTINGS_PATH_REL);
    if (!existsSync(path)) {
      return {
        agent: 'claude-code',
        applied: false,
        changes: [{ path, action: 'skip', note: 'no settings file' }],
        summary: 'nothing to uninstall',
      };
    }
    const settings = readJsonOrEmpty(path) as ClaudeSettings;
    const tracker = settings[KEYNV_DENY_TAG];
    const removedDeny: string[] = [];
    const permissions = settings.permissions;
    if (tracker?.deny_added && permissions && Array.isArray(permissions.deny)) {
      const remove = new Set(tracker.deny_added);
      const before = permissions.deny;
      permissions.deny = before.filter((entry) => {
        if (remove.has(entry)) {
          removedDeny.push(entry);
          return false;
        }
        return true;
      });
      if (permissions.deny.length === 0) delete permissions.deny;
    }
    if (tracker?.allow_added && permissions && Array.isArray(permissions.allow)) {
      const remove = new Set(tracker.allow_added);
      permissions.allow = permissions.allow.filter((entry) => !remove.has(entry));
      if (permissions.allow.length === 0) delete permissions.allow;
    }
    const hooks = settings.hooks;
    if (tracker?.hook_added && hooks && Array.isArray(hooks.PostToolUse)) {
      const filtered = hooks.PostToolUse.filter(
        (entry) => !(entry.hooks ?? []).some((h) => h.command?.includes('keynv redact-stream')),
      );
      hooks.PostToolUse = filtered;
      if (filtered.length === 0) delete hooks.PostToolUse;
    }
    delete settings[KEYNV_DENY_TAG];

    if (opts.dryRun) {
      return {
        agent: 'claude-code',
        applied: false,
        changes: [
          { path, action: 'update', note: `would remove ${removedDeny.length} denies + hook` },
        ],
        summary: `[dry-run] would remove ${removedDeny.length} denies`,
      };
    }
    writeJson(path, settings);
    return {
      agent: 'claude-code',
      applied: true,
      changes: [{ path, action: 'update' }],
      summary: `removed ${removedDeny.length} denies + hook`,
    };
  },
};
