import { readFileSync } from 'node:fs';
import { buildAlias } from '@keynv/core';
import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { parseEnvFile } from '../exec/envFile.js';
import { classifyEntry } from '../init/heuristics.js';
import { runInitFlow } from '../ui/flows/init.js';
import { UserCancelled } from '../ui/helpers/cancel.js';
import { isInteractive } from '../ui/helpers/tty.js';
import { resolveProjectId } from './project.js';

export class InitCommand extends Command {
  static override paths = [['init']];
  static override usage = Command.Usage({
    description: 'Migrate an existing project from .env to keynv.',
    details: `
Walks the current directory's .env files, prompts you to mark which
keys are real secrets, uploads those to the keynv vault, writes a
.keynv.env file with alias references, and (optionally) wraps your
package.json scripts with \`keynv exec\`.

Safe to re-run: existing .keynv.env entries are preserved; new
entries are appended below a marker.

--dry-run prints the secrets that would be uploaded and the alias
mappings that would be written to .keynv.env, then exits without
touching any files or making any network calls. Use it to preview
what init will do before committing.

Requires an interactive terminal (clack TUI). For scripted
migration, use the lower-level \`keynv project\` and \`keynv secret\`
commands directly.
`,
    examples: [
      ['Walk the current project', '$0 init'],
      ['Preview without writing or uploading', '$0 init --dry-run'],
      ['Skip the package.json script-wrapping step', '$0 init --no-scripts'],
      ['Non-interactive (CI/CD)', '$0 init --env-file .env --project myproject --env dev'],
    ],
  });

  dryRun = Option.Boolean('--dry-run', false, {
    description:
      'Scan .env files and print the secrets that would be uploaded and the alias mappings that would be written — no files written, no vault calls made.',
  });
  noScripts = Option.Boolean('--no-scripts', false, {
    description: 'Skip the package.json script-wrapping step.',
  });
  envFile = Option.String('--env-file', {
    description: 'Path to .env file to migrate (non-interactive mode).',
  });
  project = Option.String('--project', {
    description: 'Project name or ID (non-interactive mode).',
  });
  env = Option.String('--env', {
    description: 'Environment name for --env-file (default: dev).',
  });
  secret = Option.Array('--secret', {
    description: 'KEY=value secret to upload (non-interactive). Can be specified multiple times.',
  });

  async execute(): Promise<number> {
    const client = new ApiClient();
    await client.ensureHydrated();
    if (!client.isLoggedIn) {
      this.context.stderr.write('keynv: not logged in. Run `keynv login` first.\n');
      return 1;
    }

    const hasEnvFile = this.envFile != null;
    const hasSecrets = this.secret != null && this.secret.length > 0;
    const isNonInteractive = hasEnvFile || hasSecrets;

    if (isNonInteractive) {
      return this.runNonInteractive(client);
    }

    if (!isInteractive()) {
      this.context.stderr.write(
        'keynv init requires an interactive terminal. Use --env-file or --secret for scripted setup.\n',
      );
      return 1;
    }

    try {
      const outcome = await runInitFlow(client, {
        cwd: process.cwd(),
        dryRun: this.dryRun,
        noScripts: this.noScripts,
      });
      return outcome.exitCode;
    } catch (err) {
      if (err instanceof UserCancelled) return 130;
      const e = err as { code?: string; message: string; status?: number };
      this.context.stderr.write(`keynv: ${e.message}\n`);
      return 1;
    }
  }

  async runNonInteractive(client: ApiClient): Promise<number> {
    const projectName = this.project;
    if (!projectName) {
      this.context.stderr.write('keynv: --project is required in non-interactive mode.\n');
      return 1;
    }

    const resolved = await resolveProjectId(client, projectName);
    if (!resolved) {
      this.context.stderr.write(`keynv: project not found: ${projectName}\n`);
      return 1;
    }
    const projectId = resolved;

    const envName = this.env ?? 'dev';
    const secrets: Array<{ name: string; value: string }> = [];

    if (this.envFile) {
      try {
        const content = readFileSync(this.envFile, 'utf8');
        const entries = parseEnvFile(content, this.envFile);
        for (const e of entries) {
          if (classifyEntry(e.name, e.value).verdict === 'secret') {
            secrets.push({ name: e.name, value: e.value });
          }
        }
      } catch (err) {
        this.context.stderr.write(
          `keynv: cannot read ${this.envFile}: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        return 1;
      }
    }

    if (this.secret) {
      for (const spec of this.secret) {
        const eq = spec.indexOf('=');
        if (eq <= 0) {
          this.context.stderr.write(`keynv: invalid --secret '${spec}', expected KEY=value\n`);
          return 1;
        }
        const name = spec.slice(0, eq);
        const value = spec.slice(eq + 1);
        secrets.push({ name, value });
      }
    }

    if (secrets.length === 0) {
      this.context.stdout.write('keynv: nothing to migrate.\n');
      return 0;
    }

    if (this.dryRun) {
      this.context.stdout.write(
        `keynv: dry-run — would upload ${secrets.length} secret(s) to project ${projectName} (${projectId}) in env ${envName}\n`,
      );
      for (const { name } of secrets) {
        const aliasKey = name.toLowerCase().replace(/_/g, '-');
        this.context.stdout.write(`  ${name}=@${projectName}.${envName}.${aliasKey}\n`);
      }
      return 0;
    }

    let uploaded = 0;
    const failed: string[] = [];
    for (const { name, value } of secrets) {
      const aliasKey = name.toLowerCase().replace(/_/g, '-');
      const alias = buildAlias({ project: projectName, environment: envName, key: aliasKey });
      if (!alias) {
        failed.push(`${name} (invalid alias key: ${aliasKey})`);
        continue;
      }
      try {
        await client.request(`/v1/projects/${projectId}/secrets`, {
          method: 'POST',
          body: { env: envName, key: aliasKey, value },
        });
        uploaded++;
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.context.stdout.write(
      `keynv: uploaded ${uploaded}/${secrets.length} secret(s) to ${projectName}.${envName}\n`,
    );
    if (failed.length > 0) {
      for (const f of failed) this.context.stderr.write(`  failed: ${f}\n`);
      return 1;
    }
    return 0;
  }
}
