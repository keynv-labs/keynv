import { reference } from '@keynv/core';
import { runTest, testers } from '@keynv/testers';
import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { resolveProjectId } from './project.js';

function parseTargets(specs: ReadonlyArray<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of specs) {
    const eq = spec.indexOf('=');
    if (eq <= 0) {
      throw new Error(`invalid --target '${spec}', expected key=value`);
    }
    out[spec.slice(0, eq)] = spec.slice(eq + 1);
  }
  return out;
}

export class TestCommand extends Command {
  static override paths = [['test']];
  static override usage = Command.Usage({
    description: 'Verify a secret actually works against a target service.',
    details: `
The value never leaves keynv: the CLI resolves the alias, hands it
to the tester, and prints only the OK/FAIL verdict + latency. Wrong-
credential errors are sanitized so the value cannot leak through
the error message.
`,
    examples: [
      [
        'Postgres',
        '$0 test @billing.dev.db_pass --as postgres -t host=db.example.com -t port=5432 -t database=billing -t user=app',
      ],
      [
        'HTTP bearer',
        '$0 test @billing.prod.api_token --as http -t url=https://api.example.com/v1/me -t auth=bearer',
      ],
    ],
  });

  alias = Option.String();
  as = Option.String('--as', { description: 'Tester type: postgres | mysql | redis | ssh | http' });
  targets = Option.Array('--target,-t', { description: 'key=value (repeatable).' });
  json = Option.Boolean('--json', false);
  timeout = Option.String('--timeout', {
    description: 'Override the default 5s timeout (in seconds).',
  });

  async execute(): Promise<number> {
    const parsedAlias = reference.parseAlias(this.alias);
    if (!parsedAlias) {
      this.context.stderr.write(`keynv: invalid alias '${this.alias}'\n`);
      return 1;
    }
    if (!this.as) {
      this.context.stderr.write(
        `keynv: --as is required (one of: ${testers.map((t) => t.type).join(', ')})\n`,
      );
      return 2;
    }
    const tester = testers.find((t) => t.type === this.as);
    if (!tester) {
      this.context.stderr.write(`keynv: unknown tester '${this.as}'\n`);
      return 1;
    }

    const timeoutMs = this.timeout ? Number.parseInt(this.timeout, 10) * 1000 : undefined;
    if (this.timeout && (timeoutMs === undefined || Number.isNaN(timeoutMs))) {
      this.context.stderr.write('keynv: invalid --timeout (expected integer seconds)\n');
      return 2;
    }

    let target: Record<string, string>;
    try {
      target = parseTargets(this.targets ?? []);
    } catch (err) {
      this.context.stderr.write(`keynv: ${err instanceof Error ? err.message : String(err)}\n`);
      return 2;
    }

    const client = new ApiClient();
    await client.ensureHydrated();
    if (!client.isLoggedIn) {
      this.context.stderr.write('keynv: not logged in. Run `keynv login` first.\n');
      return 1;
    }

    let value: string;
    try {
      const projectId = await resolveProjectId(client, parsedAlias.project);
      const data = await client.request<{ value: string }>(
        `/v1/projects/${projectId}/secrets/${parsedAlias.environment}/${parsedAlias.key}`,
      );
      value = data.value;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.context.stderr.write(`keynv: failed to resolve ${parsedAlias.literal}: ${msg}\n`);
      return 1;
    }

    const result = await runTest({
      tester,
      secret: { alias: parsedAlias.literal, value },
      target,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    });

    if (this.json) {
      this.context.stdout.write(
        `${JSON.stringify(
          {
            alias: parsedAlias.literal,
            tester: tester.type,
            ok: result.ok,
            latency_ms: result.latency_ms,
            ...(result.error ? { error: result.error } : {}),
            ...(result.info ? { info: result.info } : {}),
          },
          null,
          2,
        )}\n`,
      );
      return result.ok ? 0 : 1;
    }

    const verdict = result.ok ? 'OK' : 'FAIL';
    this.context.stdout.write(
      `${parsedAlias.literal} via ${tester.type}: ${verdict} (${result.latency_ms} ms)\n`,
    );
    if (result.error) this.context.stdout.write(`  error: ${result.error}\n`);
    if (result.info) {
      for (const [k, v] of Object.entries(result.info)) {
        this.context.stdout.write(`  ${k}: ${String(v)}\n`);
      }
    }
    return result.ok ? 0 : 1;
  }
}
