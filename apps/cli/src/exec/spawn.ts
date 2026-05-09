import { type StdioOptions, spawn } from 'node:child_process';
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
];

export interface SpawnArgs {
  command: string;
  args: string[];
  /** key→value env vars to inject (e.g., from --via-env). */
  injectedEnv?: Record<string, string>;
  /** Resolved values to feed to the redactor as literals. */
  resolved: ReadonlyArray<ResolvedAlias>;
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
  if (opts.injectedEnv) {
    for (const [k, v] of Object.entries(opts.injectedEnv)) env[k] = v;
  }

  // stdio: inherit stdin from parent; capture stdout + stderr to pipe
  // them through the redactor. The agent process ultimately reads
  // *our* stdout/stderr, so this is the right interception point.
  const stdio: StdioOptions = ['inherit', 'pipe', 'pipe'];

  const child = spawn(opts.command, opts.args, {
    env,
    stdio,
    detached: false,
  });

  const literals = opts.resolved.map((r) => r.value).filter((v) => v.length > 0);

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
      reject(err);
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: code ?? 0,
        signal,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}
