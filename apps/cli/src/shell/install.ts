import { constants, access, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { BLOCK_END, BLOCK_START, type ShellTemplate, TEMPLATES } from './templates.js';

export type Shell = 'zsh' | 'bash' | 'fish';

export interface InstallResult {
  readonly shell: Shell;
  /** `~/.zshrc` style display path of the rc file we touched. */
  readonly rcPath: string;
  /** Path of the hook script we wrote. */
  readonly hookPath: string;
  readonly status: 'installed' | 'already-installed' | 'skipped';
  readonly skipReason?: string;
}

export interface UninstallResult {
  readonly shell: Shell;
  readonly rcPath: string;
  readonly hookPath: string;
  readonly status: 'removed' | 'not-installed' | 'skipped';
  readonly skipReason?: string;
}

export interface StatusResult {
  readonly shell: Shell;
  readonly rcPath: string;
  readonly hookPath: string;
  readonly rcPresent: boolean;
  readonly blockPresent: boolean;
  readonly hookPresent: boolean;
}

/**
 * Returns the resolved install paths for a given shell. Honours the
 * KEYNV_SHELL_HOME env var (used by tests to stub $HOME).
 */
function paths(t: ShellTemplate): {
  rcPath: string;
  hookDir: string;
  hookPath: string;
} {
  const home = process.env.KEYNV_SHELL_HOME ?? homedir();
  const rcPath = join(home, t.rcFile);
  const hookDir = join(home, '.config', 'keynv', 'shell');
  const hookPath = join(hookDir, t.hookFilename);
  return { rcPath, hookDir, hookPath };
}

function templateFor(shell: Shell): ShellTemplate {
  const t = TEMPLATES.find((x) => x.shell === shell);
  if (!t) throw new Error(`unknown shell: ${shell}`);
  return t;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function blockText(sourceLine: string): string {
  return `${BLOCK_START} (managed by \`keynv shell install\`; remove with \`keynv shell uninstall\`)\n${sourceLine}\n${BLOCK_END}\n`;
}

const BLOCK_REGEX = new RegExp(
  `\\n*${escapeRegex(BLOCK_START)}[\\s\\S]*?${escapeRegex(BLOCK_END)}\\n?`,
  'g',
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Install the keynv shell hook for `shell`.
 *
 *   1. Write the hook body to ~/.config/keynv/shell/<filename>.
 *   2. Append a marked sourcing block to the rc file if not present.
 *
 * Idempotent: re-running upgrades the hook body but only ever touches
 * the rc file when the block is missing.
 */
export async function install(shell: Shell): Promise<InstallResult> {
  const t = templateFor(shell);
  const { rcPath, hookDir, hookPath } = paths(t);

  // Always rewrite the hook body so users picking up a new keynv
  // version get the new pattern bank without a separate command.
  await mkdir(hookDir, { recursive: true });
  await writeFile(hookPath, t.hookBody, { mode: 0o644 });

  // Touch the rc file. If it doesn't exist we *create* it — the user
  // chose to opt-in by running `keynv shell install`, creating a
  // fresh .zshrc is a reasonable side effect.
  const rcExisted = await exists(rcPath);
  await mkdir(dirname(rcPath), { recursive: true });
  const rc = rcExisted ? await readFile(rcPath, 'utf8') : '';

  if (rc.includes(BLOCK_START) && rc.includes(BLOCK_END)) {
    return { shell, rcPath, hookPath, status: 'already-installed' };
  }

  const block = blockText(t.sourceLine(hookPath));
  const next = rc.length === 0 ? block : `${rc.replace(/\n*$/, '\n\n')}${block}`;
  await writeFile(rcPath, next, { mode: 0o644 });

  return { shell, rcPath, hookPath, status: 'installed' };
}

/**
 * Remove the marked block from the rc file and (optionally) delete
 * the hook script. We leave the script in place by default — the
 * marked block is the only thing that *activates* it.
 */
export async function uninstall(
  shell: Shell,
  options: { deleteHookFile?: boolean } = {},
): Promise<UninstallResult> {
  const t = templateFor(shell);
  const { rcPath, hookPath } = paths(t);

  const rcExisted = await exists(rcPath);
  if (!rcExisted) {
    return {
      shell,
      rcPath,
      hookPath,
      status: 'not-installed',
      skipReason: `rc file missing: ${rcPath}`,
    };
  }

  const rc = await readFile(rcPath, 'utf8');
  if (!rc.includes(BLOCK_START)) {
    return { shell, rcPath, hookPath, status: 'not-installed' };
  }

  const next = rc.replace(BLOCK_REGEX, '\n').replace(/\n{3,}/g, '\n\n');
  await writeFile(rcPath, next, { mode: 0o644 });

  if (options.deleteHookFile && (await exists(hookPath))) {
    await unlink(hookPath);
  }

  return { shell, rcPath, hookPath, status: 'removed' };
}

export async function status(shell: Shell): Promise<StatusResult> {
  const t = templateFor(shell);
  const { rcPath, hookPath } = paths(t);

  const rcPresent = await exists(rcPath);
  let blockPresent = false;
  if (rcPresent) {
    try {
      const rc = await readFile(rcPath, 'utf8');
      blockPresent = rc.includes(BLOCK_START) && rc.includes(BLOCK_END);
    } catch {
      blockPresent = false;
    }
  }

  let hookPresent = false;
  try {
    const st = await stat(hookPath);
    hookPresent = st.isFile();
  } catch {
    hookPresent = false;
  }

  return { shell, rcPath, hookPath, rcPresent, blockPresent, hookPresent };
}

export function knownShells(): ReadonlyArray<Shell> {
  return TEMPLATES.map((t) => t.shell);
}
