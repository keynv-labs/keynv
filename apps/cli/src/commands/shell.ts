import { homedir } from 'node:os';
import { relative } from 'node:path';
import { Command, Option } from 'clipanion';
import { type Shell, install, knownShells, status, uninstall } from '../shell/install.js';
import { handleExecError } from '../ui/format.js';

const VALID_SHELLS = knownShells();

function tilde(p: string): string {
  const home = homedir();
  if (p === home) return '~';
  if (p.startsWith(`${home}/`)) return `~/${relative(home, p)}`;
  return p;
}

function detectShell(): Shell | undefined {
  const explicit = process.env.SHELL;
  if (!explicit) return undefined;
  if (explicit.endsWith('/zsh')) return 'zsh';
  if (explicit.endsWith('/bash')) return 'bash';
  if (explicit.endsWith('/fish')) return 'fish';
  return undefined;
}

type ParsedShell =
  | { readonly ok: true; readonly shell: Shell }
  | { readonly ok: false; readonly error: string };

function parseShell(input: string | undefined): ParsedShell {
  if (!input) {
    const detected = detectShell();
    if (detected) return { ok: true, shell: detected };
    return {
      ok: false,
      error: `cannot detect shell from $SHELL ('${process.env.SHELL ?? ''}'). Pass --shell=zsh|bash|fish.`,
    };
  }
  if ((VALID_SHELLS as ReadonlyArray<string>).includes(input)) {
    return { ok: true, shell: input as Shell };
  }
  return { ok: false, error: `unknown shell '${input}'. Valid: ${VALID_SHELLS.join(', ')}.` };
}

/**
 * `keynv shell install` — preventive history hook for zsh/bash/fish.
 *
 * Writes a hook script under ~/.config/keynv/shell/ and appends a
 * marked sourcing block to the user's rc file. The hook scrubs
 * secret-shaped substrings on each command line BEFORE the line lands
 * in the shell history file. Pure-regex; no subprocess unless a match
 * fires.
 *
 * The hook bank is a hand-mirrored POSIX-ERE subset of
 * `@keynv/redactor` patterns — vendor-prefixed tokens, JWTs, and
 * credential-bearing URIs. Re-run `keynv shell install` after a keynv
 * upgrade to pick up new patterns.
 */
export class ShellInstallCommand extends Command {
  static override paths = [['shell', 'install']];
  static override usage = Command.Usage({
    description: 'Install the keynv shell history hook for the current shell.',
    examples: [
      ['Auto-detect ($SHELL)', '$0 shell install'],
      ['Explicit', '$0 shell install --shell zsh'],
      ['All known shells', '$0 shell install --all'],
    ],
  });

  shellName = Option.String('--shell');
  all = Option.Boolean('--all', false);
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      let targets: ReadonlyArray<Shell>;
      if (this.all) {
        targets = VALID_SHELLS;
      } else {
        const parsed = parseShell(this.shellName);
        if (!parsed.ok) {
          this.context.stderr.write(`keynv: ${parsed.error}\n`);
          return 2;
        }
        targets = [parsed.shell];
      }

      const out = await Promise.all(targets.map((s) => install(s)));

      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ results: out }, null, 2)}\n`);
        return 0;
      }

      for (const r of out) {
        const verb = r.status === 'installed' ? 'installed' : 'already installed';
        this.context.stdout.write(`keynv: ${r.shell} hook ${verb}\n`);
        this.context.stdout.write(`  rc:   ${tilde(r.rcPath)}\n`);
        this.context.stdout.write(`  hook: ${tilde(r.hookPath)}\n`);
      }
      this.context.stdout.write(
        '\nStart a new shell (or `source` the rc file) for the hook to take effect.\n',
      );
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class ShellUninstallCommand extends Command {
  static override paths = [['shell', 'uninstall']];
  static override usage = Command.Usage({
    description: 'Remove the keynv shell history hook from the rc file.',
    details: `
By default the hook script under ~/.config/keynv/shell/ is left in
place — the rc-file block is what activates it. Pass --purge to
also delete the script file.
`,
  });

  shellName = Option.String('--shell');
  all = Option.Boolean('--all', false);
  purge = Option.Boolean('--purge', false);
  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      let targets: ReadonlyArray<Shell>;
      if (this.all) {
        targets = VALID_SHELLS;
      } else {
        const parsed = parseShell(this.shellName);
        if (!parsed.ok) {
          this.context.stderr.write(`keynv: ${parsed.error}\n`);
          return 2;
        }
        targets = [parsed.shell];
      }

      const out = await Promise.all(
        targets.map((s) => uninstall(s, { deleteHookFile: this.purge })),
      );

      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ results: out }, null, 2)}\n`);
        return 0;
      }

      for (const r of out) {
        if (r.status === 'removed') {
          this.context.stdout.write(`keynv: ${r.shell} hook removed from ${tilde(r.rcPath)}\n`);
        } else {
          this.context.stdout.write(
            `keynv: ${r.shell} hook not installed${r.skipReason ? ` (${r.skipReason})` : ''}\n`,
          );
        }
      }
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class ShellStatusCommand extends Command {
  static override paths = [['shell', 'status']];
  static override usage = Command.Usage({
    description: 'Show whether the keynv shell history hook is installed.',
  });

  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      const out = await Promise.all(VALID_SHELLS.map((s) => status(s)));
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ shells: out }, null, 2)}\n`);
        return 0;
      }

      for (const s of out) {
        const tag =
          s.blockPresent && s.hookPresent
            ? 'installed'
            : s.rcPresent
              ? 'not installed'
              : 'rc absent';
        this.context.stdout.write(`  ${s.shell.padEnd(5)}  ${tag}\n`);
        this.context.stdout.write(
          `         rc:   ${tilde(s.rcPath)} ${s.rcPresent ? '' : '(missing)'}\n`,
        );
        this.context.stdout.write(
          `         hook: ${tilde(s.hookPath)} ${s.hookPresent ? '' : '(missing)'}\n`,
        );
      }
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}
