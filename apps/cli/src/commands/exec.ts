import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
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
--via-env. The intent is to keep accidental secrets in the caller's
shell from being seen by the subprocess (and by extension, the AI
agent that wraps it).
`,
    examples: [
      [
        'Run mysql with the alias substituted at fork-exec time',
        '$0 exec -- mysql -p@billing.dev.db_pass -h db.example.com',
      ],
      [
        'Inject env vars without showing them in argv',
        '$0 exec --via-env DB_PASS=@billing.dev.db_pass -- node ./scripts/migrate.js',
      ],
    ],
  });

  viaEnv = Option.Array('--via-env', {
    description: 'NAME=@alias — set NAME in the subprocess env (alias is NOT placed in argv).',
  });
  noRedact = Option.Boolean('--no-redact', false, {
    description: 'Disable the stdout/stderr redactor. Audit-flagged.',
  });
  timeout = Option.String('--timeout', { description: 'Kill subprocess after N seconds.' });

  // Everything after `--` is the command + its args.
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

    // Resolve every alias appearing in argv OR --via-env values.
    let resolved: Awaited<ReturnType<typeof resolveAllAliases>>;
    try {
      resolved = await resolveAllAliases(
        client,
        [command, ...args],
        viaEnvSpecs.map((s) => s.aliasLiteral),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.context.stderr.write(`keynv: ${message}\n`);
      return 1;
    }

    // Build substituted argv.
    const substArgs = args.map((a) => substitute(a, resolved));
    const substCommand = substitute(command, resolved);

    // Build injected env from --via-env.
    const injectedEnv: Record<string, string> = {};
    for (const spec of viaEnvSpecs) {
      const value = substitute(spec.aliasLiteral, resolved);
      if (value === spec.aliasLiteral) {
        // Substitution failed — alias literal made it through.
        this.context.stderr.write(
          `keynv: --via-env ${spec.name}: alias ${spec.aliasLiteral} did not resolve\n`,
        );
        return 1;
      }
      injectedEnv[spec.name] = value;
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
