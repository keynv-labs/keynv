import { relative } from 'node:path';
import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import {
  ENV_FILE_BASENAME,
  type EnvFileEntry,
  EnvFileNotFoundError,
  EnvFileParseError,
  EnvFileTooLargeError,
  loadEnvFile,
} from '../exec/envFile.js';
import { resolveAllAliases, substitute } from '../exec/resolve.js';
import { spawnPrivileged } from '../exec/spawn.js';

export class ExecCommand extends Command {
  static override paths = [['exec']];
  static override usage = Command.Usage({
    description:
      'Run a command with @aliases substituted in argv. Real values stay out of the calling process.',
    details: `
The flagship safety primitive. \`keynv exec\` parses every \`@project.env.key\`
literal in the command and its arguments, resolves them via the keynv
server, then forks the subprocess with the resolved values in argv (or
in env via --via-env). Subprocess stdout/stderr is line-buffered through
the redactor before being copied to the calling process's stdout/stderr.

The subprocess does NOT inherit the caller's full environment; only
PATH/HOME/USER/SHELL/TERM/LANG/etc. plus anything passed through
--via-env or via an auto-loaded ${ENV_FILE_BASENAME} file.

If a ${ENV_FILE_BASENAME} file is found in the current directory or any
parent (walked git-style), every NAME=@alias entry is resolved and
injected into the subprocess env. Plain NAME=value lines are passed
through unchanged. The file is safe to commit because it carries
references, not values. Use \`--no-env-file\` to opt out, \`--from PATH\`
to load a specific file, or set KEYNV_ENV_FILE in the environment.

(Note: Node.js itself reserves \`--env-file\`, so the keynv flag is
spelled \`--from\` to avoid the collision.)
`,
    examples: [
      ['Auto-load .keynv.env from cwd or parents', '$0 exec -- next dev'],
      [
        'Run mysql with the alias substituted at fork-exec time',
        '$0 exec -- mysql -p@billing.dev.db_pass -h db.example.com',
      ],
      [
        'Inject env vars without showing them in argv',
        '$0 exec --via-env DB_PASS=@billing.dev.db_pass -- node ./scripts/migrate.js',
      ],
      ['Skip auto-discovery', '$0 exec --no-env-file -- npm test'],
    ],
  });

  viaEnv = Option.Array('--via-env', {
    description: 'NAME=@alias — set NAME in the subprocess env (alias is NOT placed in argv).',
  });
  noRedact = Option.Boolean('--no-redact', false, {
    description: 'Disable the stdout/stderr redactor. Audit-flagged.',
  });
  timeout = Option.String('--timeout', { description: 'Kill subprocess after N seconds.' });
  envFile = Option.String('--from', {
    description: `Load env mappings from this file instead of auto-discovering ${ENV_FILE_BASENAME}. Errors if missing. (Node intercepts \`--env-file\` for itself, so we use \`--from\`.)`,
  });
  noEnvFile = Option.Boolean('--no-env-file', false, {
    description: `Skip auto-loading ${ENV_FILE_BASENAME} (and ignore KEYNV_ENV_FILE).`,
  });
  quiet = Option.Boolean('--quiet', false, {
    description: `Suppress the "loaded N vars from ${ENV_FILE_BASENAME}" status line.`,
  });

  // Option.Rest: keynv options (e.g. --no-env-file) are parsed before `--`.
  // Everything after `--` is captured in rest verbatim, including subprocess
  // flags like `--port 3005` and `-v`. Always use `--` to separate keynv
  // options from the subprocess command.
  rest = Option.Rest();

  async execute(): Promise<number> {
    if (!this.rest || this.rest.length === 0) {
      this.context.stderr.write(
        'keynv: missing command. Usage: keynv exec [opts] -- <cmd> [args...]\n',
      );
      return 2;
    }
    const [command, ...args] = this.rest;
    if (!command) {
      this.context.stderr.write('keynv: missing command\n');
      return 2;
    }

    const client = new ApiClient();
    await client.ensureHydrated();
    if (!client.isLoggedIn) {
      this.context.stderr.write('keynv: not logged in. Run `keynv login` first.\n');
      return 1;
    }

    // Load .keynv.env (or explicit override) before parsing --via-env so
    // we can resolve every alias in a single round-trip and report
    // override conflicts coherently.
    let envFileLoaded: { path: string; entries: EnvFileEntry[] } | null = null;
    try {
      const loaded = loadEnvFile({
        cwd: process.cwd(),
        disabled: this.noEnvFile,
        ...(this.envFile !== undefined ? { explicitPath: this.envFile } : {}),
        ...(process.env.KEYNV_ENV_FILE !== undefined
          ? { envVarOverride: process.env.KEYNV_ENV_FILE }
          : {}),
      });
      if (loaded) {
        envFileLoaded = loaded;
      }
    } catch (err) {
      if (
        err instanceof EnvFileNotFoundError ||
        err instanceof EnvFileParseError ||
        err instanceof EnvFileTooLargeError
      ) {
        this.context.stderr.write(`keynv: ${err.message}\n`);
        return 2;
      }
      this.context.stderr.write(
        `keynv: unexpected error loading env file: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      return 2;
    }

    if (!envFileLoaded && !this.noEnvFile && !this.envFile && !process.env.KEYNV_ENV_FILE) {
      this.context.stderr.write(
        `keynv: no ${ENV_FILE_BASENAME} found in this directory or any parent.\n       Run \`keynv init\` in your project root to migrate secrets and create one.\n`,
      );
    }

    // Parse --via-env entries (NAME=@alias).
    const viaEnvSpecs: Array<{ name: string; aliasLiteral: string }> = [];
    for (const spec of this.viaEnv ?? []) {
      const eq = spec.indexOf('=');
      if (eq <= 0) {
        this.context.stderr.write(`keynv: invalid --via-env '${spec}', expected NAME=@alias\n`);
        return 2;
      }
      viaEnvSpecs.push({
        name: spec.slice(0, eq),
        aliasLiteral: spec.slice(eq + 1),
      });
    }

    // Build the union of alias-bearing strings to resolve. The
    // resolver scans for @aliases inside each string, so passing the
    // raw values (rather than just the literals) is fine.
    const extraAliasStrings: string[] = [];
    if (envFileLoaded) {
      for (const e of envFileLoaded.entries) {
        if (e.isAlias) extraAliasStrings.push(e.value);
      }
    }
    for (const s of viaEnvSpecs) extraAliasStrings.push(s.aliasLiteral);

    let resolved: Awaited<ReturnType<typeof resolveAllAliases>>;
    try {
      resolved = await resolveAllAliases(client, [command, ...args], extraAliasStrings);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.context.stderr.write(`keynv: ${message}\n`);
      return 1;
    }

    // Substituted argv.
    const substArgs = args.map((a) => substitute(a, resolved));
    const substCommand = substitute(command, resolved);

    // Build the injected env: env file first (last-wins on its own
    // duplicates), then --via-env overlays so a CLI override beats the
    // file. Conflict warnings go to stderr so the developer sees what
    // happened.
    const injectedEnv: Record<string, string> = {};
    const fromEnvFile = new Map<string, number>(); // name → line, for warning
    if (envFileLoaded) {
      for (const e of envFileLoaded.entries) {
        if (e.isAlias) {
          const subst = substitute(e.value, resolved);
          if (subst === e.value) {
            this.context.stderr.write(
              `keynv: ${envFileLoaded.path}:${e.line}: alias ${e.value} did not resolve\n`,
            );
            return 1;
          }
          injectedEnv[e.name] = subst;
        } else {
          injectedEnv[e.name] = e.value;
        }
        fromEnvFile.set(e.name, e.line);
      }
    }
    for (const spec of viaEnvSpecs) {
      const value = substitute(spec.aliasLiteral, resolved);
      if (value === spec.aliasLiteral) {
        this.context.stderr.write(
          `keynv: --via-env ${spec.name}: alias ${spec.aliasLiteral} did not resolve\n`,
        );
        return 1;
      }
      const overriddenLine = fromEnvFile.get(spec.name);
      if (overriddenLine !== undefined && envFileLoaded && !this.quiet) {
        this.context.stderr.write(
          `keynv: --via-env ${spec.name} overrides ${envFileLoaded.path}:${overriddenLine}\n`,
        );
      }
      injectedEnv[spec.name] = value;
    }

    if (envFileLoaded && !this.quiet) {
      const aliasEntries = envFileLoaded.entries.filter((e) => e.isAlias);
      const plainEntries = envFileLoaded.entries.filter((e) => !e.isAlias);
      const displayPath = relative(process.cwd(), envFileLoaded.path) || envFileLoaded.path;
      const parts: string[] = [];
      if (aliasEntries.length > 0) {
        parts.push(`${aliasEntries.map((e) => `${e.name}=${e.value}`).join(', ')} (vault)`);
      }
      if (plainEntries.length > 0) {
        parts.push(`${plainEntries.map((e) => e.name).join(', ')} (plain)`);
      }
      this.context.stderr.write(
        `keynv: loaded ${displayPath}${parts.length > 0 ? ` — ${parts.join('; ')}` : ''}\n`,
      );
    }

    const timeoutS = this.timeout ? Number.parseInt(this.timeout, 10) : undefined;
    if (this.timeout && (timeoutS === undefined || Number.isNaN(timeoutS))) {
      this.context.stderr.write('keynv: invalid --timeout (expected integer seconds)\n');
      return 2;
    }

    try {
      const result = await spawnPrivileged({
        command: substCommand,
        args: substArgs,
        injectedEnv,
        resolved,
        noRedact: this.noRedact,
        timeoutS,
      });
      if (result.signal) return 128 + (signalNumber(result.signal) ?? 0);
      return result.exitCode;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.context.stderr.write(`keynv: failed to spawn '${substCommand}': ${message}\n`);
      return 127;
    }
  }
}

function signalNumber(sig: NodeJS.Signals): number | null {
  const map: Partial<Record<NodeJS.Signals, number>> = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGQUIT: 3,
    SIGKILL: 9,
    SIGSEGV: 11,
    SIGTERM: 15,
  };
  return map[sig] ?? null;
}
