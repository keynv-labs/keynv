import { type StdioOptions, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as nodePath from 'node:path';
import { createRedactStream } from '@keynv/redactor';
import type { ResolvedAlias } from './resolve.js';

/**
 * Names of environment variables that we explicitly carry over to the
 * subprocess. Anything else from the caller's environment is dropped.
 *
 * The intent is *not* that the agent has secrets in its env (it
 * shouldn't); rather, this is a belt-and-suspenders so an accidental
 * `export DB_PASSWORD=...` in the caller shell can't leak through.
 */
const ENV_ALLOWLIST: ReadonlyArray<string> = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LC_MESSAGES',
  'LC_NUMERIC',
  'LC_TIME',
  'TZ',
  'PWD',
  'OLDPWD',
  'TMPDIR',
  'SSH_AUTH_SOCK',
  // Windows-specific
  'USERPROFILE',
  'USERNAME',
  'COMPUTERNAME',
  'TEMP',
  'TMP',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'COMSPEC',
  'APPDATA',
  'LOCALAPPDATA',
  'PATHEXT', // needed so child processes can resolve executables by name
];

export interface SpawnArgs {
  command: string;
  args: string[];
  /** key→value env vars to inject (e.g., from --via-env). */
  injectedEnv?: Record<string, string>;
  /** Resolved values to feed to the redactor as literals. */
  resolved: ReadonlyArray<ResolvedAlias>;
  /**
   * Extra secret values (e.g. resolved via `--resolve <mcp-token>`) that have
   * no alias literal in argv but must still be redacted from output and
   * zeroed on exit.
   */
  extraLiterals?: ReadonlyArray<string>;
  /** Disable the redactor on stdout/stderr. Audit-flagged. */
  noRedact?: boolean;
  /** Hard timeout in seconds. */
  timeoutS?: number | undefined;
}

export interface SpawnResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

/**
 * fork+execs the given command with a curated environment, piping
 * stdout/stderr through the redactor before forwarding to the parent
 * process's tty/pipes. stdin is inherited so interactive subprocesses
 * keep working.
 */
export function spawnPrivileged(opts: SpawnArgs): Promise<SpawnResult> {
  const startedAt = Date.now();

  const env: Record<string, string> = {};
  for (const name of ENV_ALLOWLIST) {
    const v = process.env[name];
    if (v !== undefined) env[name] = v;
  }

  // Add node_modules/.bin to PATH so project-local tools (next, vite, etc.)
  // are resolvable without wrapping in npx. Walk up from cwd to find the
  // nearest node_modules/.bin, or use the common one in the repo root.
  const nmBin = findNodeModulesBin(process.cwd());
  if (nmBin) {
    const existingPath = env.PATH ?? '';
    env.PATH = existingPath.startsWith(nmBin + nodePath.delimiter)
      ? existingPath
      : nmBin + nodePath.delimiter + existingPath;
  }

  if (opts.injectedEnv) {
    for (const [k, v] of Object.entries(opts.injectedEnv)) env[k] = v;
  }

  // stdio: inherit stdin from parent; capture stdout + stderr to pipe
  // them through the redactor. The agent process ultimately reads
  // *our* stdout/stderr, so this is the right interception point.
  const stdio: StdioOptions = ['inherit', 'pipe', 'pipe'];

  // On Windows, cmd.exe built-ins (echo, dir, type, …) are not file-system
  // executables. We wrap them transparently instead of using shell:true,
  // which triggers DEP0190 and complicates argument quoting semantics.
  const WIN_BUILTINS = new Set([
    'echo',
    'dir',
    'type',
    'copy',
    'del',
    'move',
    'ren',
    'md',
    'mkdir',
    'rd',
    'rmdir',
    'cd',
    'cls',
    'set',
    'pause',
    'find',
    'where',
  ]);
  let spawnCmd = opts.command;
  let spawnArgs = opts.args;
  let windowsVerbatimArguments = false;
  if (process.platform === 'win32') {
    const comspec = env.COMSPEC ?? process.env.COMSPEC ?? 'cmd.exe';
    if (WIN_BUILTINS.has(opts.command.toLowerCase())) {
      spawnCmd = comspec;
      spawnArgs = ['/d', '/s', '/c', opts.command, ...opts.args];
    } else {
      // Node's spawn() on Windows won't resolve .cmd/.bat executables
      // without shell:true. Resolve explicitly so `next`, `npx`, `jest`,
      // etc. work when they're node_modules/.bin/<name>.cmd wrappers.
      const resolved = resolveWindowsCmd(opts.command, env);
      if (resolved !== null) {
        const ext = nodePath.extname(resolved).toLowerCase();
        if (ext === '.cmd' || ext === '.bat') {
          // Build the cmd.exe command line manually to handle paths with spaces.
          // Node.js's automatic quoting can corrupt the /s /c argument when the
          // .cmd path contains spaces (e.g. C:\Users\John Doe\...\next.cmd).
          // Pattern: wrap the ENTIRE inner command in outer quotes so /s strips
          // exactly the outermost pair → "\"path with spaces\file.cmd\" args"
          const q = (s: string) => (s.includes(' ') ? `"${s}"` : s);
          const inner = [q(resolved), ...opts.args.map(q)].join(' ');
          spawnCmd = comspec;
          spawnArgs = ['/d', '/s', '/c', `"${inner}"`];
          windowsVerbatimArguments = true;
        } else {
          spawnCmd = resolved;
        }
      }
    }
  }

  const child = spawn(spawnCmd, spawnArgs, {
    env,
    stdio,
    detached: false,
    windowsVerbatimArguments,
  });

  const literals = [...opts.resolved.map((r) => r.value), ...(opts.extraLiterals ?? [])].filter(
    (v) => v.length > 0,
  );

  if (!opts.noRedact && child.stdout) {
    child.stdout.pipe(createRedactStream({ literals })).pipe(process.stdout);
  } else if (child.stdout) {
    child.stdout.pipe(process.stdout);
  }
  if (!opts.noRedact && child.stderr) {
    child.stderr.pipe(createRedactStream({ literals })).pipe(process.stderr);
  } else if (child.stderr) {
    child.stderr.pipe(process.stderr);
  }

  let timer: NodeJS.Timeout | null = null;
  if (opts.timeoutS && opts.timeoutS > 0) {
    timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000).unref();
    }, opts.timeoutS * 1000);
    timer.unref();
  }

  return new Promise<SpawnResult>((resolve, reject) => {
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      clearSensitiveReferences(env, literals);
      reject(err);
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      clearSensitiveReferences(env, literals);
      resolve({
        exitCode: code ?? 0,
        signal,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function clearSensitiveReferences(env: Record<string, string>, literals: string[]): void {
  for (const key of Object.keys(env)) env[key] = '';
  literals.fill('');
}

/**
 * On Windows, Node's spawn() with shell:false won't resolve .cmd/.bat
 * executables (e.g. node_modules/.bin/next.cmd). We do the PATHEXT
 * search ourselves so the caller can wrap the result in cmd.exe.
 *
 * Returns the full path if found, or null if we should let spawn() try
 * as-is (absolute path, or .exe that spawn handles natively).
 */
export function resolveWindowsCmd(
  command: string,
  subprocessEnv: Record<string, string>,
): string | null {
  // Already has an explicit extension — don't second-guess it.
  if (nodePath.extname(command)) return null;
  // Absolute or relative path — don't search.
  if (command.includes('/') || command.includes('\\')) return null;

  const pathExt = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((e) => e.toLowerCase())
    .filter(Boolean);

  const pathStr = subprocessEnv.PATH ?? process.env.PATH ?? '';
  const pathDirs = pathStr.split(nodePath.delimiter).filter(Boolean);

  for (const dir of pathDirs) {
    for (const ext of pathExt) {
      try {
        const full = nodePath.join(dir, command + ext);
        if (existsSync(full)) return full;
      } catch {
        // skip dirs that can't be stat'd
      }
    }
  }
  return null;
}

/**
 * Walk up from `cwd` to find the nearest `node_modules/.bin` directory.
 * Returns the full path or null if none is found (e.g. the project does
 * not have node_modules installed).
 */
function findNodeModulesBin(cwd: string): string | null {
  let dir = nodePath.resolve(cwd);
  for (let i = 0; i < 20; i++) {
    const candidate = nodePath.join(dir, 'node_modules', '.bin');
    if (existsSync(candidate)) return candidate;
    const parent = nodePath.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
