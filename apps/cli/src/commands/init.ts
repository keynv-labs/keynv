import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reference } from '@keynv/core';
import { Command, Option } from 'clipanion';
import { ApiClient } from '../client/http.js';
import { parseEnvFile } from '../exec/envFile.js';
import { writeAiContext } from '../init/ai-context.js';
import { findEnvFiles, findProjectRoot, suggestedEnvForSuffix } from '../init/detect.js';
import { classifyEntry } from '../init/heuristics.js';
import { runInitFlow } from '../ui/flows/init.js';
import { UserCancelled } from '../ui/helpers/cancel.js';
import { isInteractive } from '../ui/helpers/tty.js';
import { resolveProjectId } from './project.js';

/**
 * Normalise a raw env-var name to a vault alias key. Preserves the
 * original case when valid; falls back to lowercase + underscore→dash
 * for names that would otherwise fail KEY_RE validation.
 */
function toAliasKey(name: string): string {
  if (!name) return name;
  const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
  if (KEY_RE.test(name)) return name;
  const normalised = name.toLowerCase().replace(/_/g, '-');
  if (KEY_RE.test(normalised)) return normalised;
  return normalised.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'key';
}

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

For scripted migration, use \`--env-file\` or \`--secret\` flags, or
\`--yes\` to auto-scan the project directory and set up without
any prompts.
`,
    examples: [
      ['Walk the current project', '$0 init'],
      ['Preview without writing or uploading', '$0 init --dry-run'],
      ['Skip the package.json script-wrapping step', '$0 init --no-scripts'],
      ['Non-interactive (CI/CD)', '$0 init --env-file .env --project myproject --env dev'],
      ['Auto-scan & set up without prompts (CI/CD)', '$0 init --yes'],
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
  yes = Option.Boolean('--yes', false, {
    description:
      'Auto-scan .env files, classify, and set up without prompts. Implies non-interactive mode.',
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
    const isNonInteractive = hasEnvFile || hasSecrets || this.dryRun || this.yes;

    if (isNonInteractive) {
      return this.runNonInteractive(client);
    }

    if (!isInteractive()) {
      this.context.stderr.write(
        'keynv init requires an interactive terminal. Use --dry-run, --env-file, or --secret for scripted setup.\n',
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
    // If --yes and no explicit --env-file/--secret, auto-scan the
    // project directory for .env files.
    if (this.yes && !this.envFile && !this.secret) {
      return this.runAutoScan(client);
    }

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
      if (this.envFile || (this.secret && this.secret.length > 0)) {
        this.context.stdout.write(
          `keynv: dry-run — would upload ${secrets.length} secret(s) to project ${projectName} (${projectId}) in env ${envName}\n`,
        );
        for (const { name } of secrets) {
          const aliasKey = toAliasKey(name);
          this.context.stdout.write(`  ${name}=@${projectName}.${envName}.${aliasKey}\n`);
        }
        return 0;
      }
      this.context.stdout.write(
        'keynv: dry-run mode — no --env-file or --secret provided. Nothing to scan.\n',
      );
      return 0;
    }

    const secretsWithKeys = secrets.map((s) => ({ ...s, aliasKey: toAliasKey(s.name) }));
    return this.uploadSecrets(client, projectId, projectName, envName, secretsWithKeys);
  }

  /**
   * Auto-scan mode (--yes without explicit --env-file). Finds .env files
   * in the project root, classifies entries, creates a project, uploads
   * secrets, and writes .keynv.env — all without prompts.
   */
  async runAutoScan(client: ApiClient): Promise<number> {
    const root = findProjectRoot(process.cwd());
    if (!root) {
      this.context.stderr.write('keynv: no project root found (no package.json, .git, etc.).\n');
      return 1;
    }

    const envFiles = findEnvFiles(root.path);
    if (envFiles.length === 0) {
      this.context.stdout.write('keynv: no .env files found. Nothing to migrate.\n');
      return 0;
    }

    const projectName = this.project ?? root.suggestedName;
    const envName = this.env ?? suggestedEnvForSuffix(envFiles[0]?.suffix ?? null);

    // Scan and classify entries from all env files
    const secrets: Array<{ name: string; value: string }> = [];
    for (const f of envFiles) {
      try {
        const entries = parseEnvFile(readFileSync(f.path, 'utf8'), f.path);
        for (const e of entries) {
          if (classifyEntry(e.name, e.value).verdict === 'secret') {
            secrets.push({ name: e.name, value: e.value });
          }
        }
      } catch {
        this.context.stderr.write(`keynv: warning — could not parse ${f.name}, skipping.\n`);
      }
    }

    if (secrets.length === 0) {
      this.context.stdout.write('keynv: no secrets detected in .env files. Nothing to upload.\n');
      return 0;
    }

    this.context.stdout.write(
      `keynv: auto-scan found ${secrets.length} secret(s) across ${envFiles.length} file(s).\n`,
    );

    if (this.dryRun) {
      for (const { name } of secrets) {
        const aliasKey = toAliasKey(name);
        this.context.stdout.write(`  ${name}=@${projectName}.${envName}.${aliasKey}\n`);
      }
      return 0;
    }

    // Resolve or create the project
    let projectId: string;
    try {
      projectId = await resolveProjectId(client, projectName);
    } catch {
      const created = await client.request<{ id: string; name: string }>('/v1/projects', {
        method: 'POST',
        body: {
          name: projectName,
          environments: [{ name: envName, tier: 'non-production', require_approval: false }],
        },
      });
      projectId = created.id;
      this.context.stdout.write(`keynv: created project "${projectName}" (${projectId}).\n`);
    }

    const secretsWithKeys = secrets.map((s) => ({ ...s, aliasKey: toAliasKey(s.name) }));
    const result = await this.uploadSecrets(
      client,
      projectId,
      projectName,
      envName,
      secretsWithKeys,
    );
    if (result !== 0) return result;

    // Write .keynv.env with alias mappings
    const aliasLines = secretsWithKeys
      .map((s) => `# ${s.name}\n${s.name}=@${projectName}.${envName}.${s.aliasKey}`)
      .join('\n');
    const keynvEnvPath = join(root.path, '.keynv.env');
    writeFileSync(keynvEnvPath, `# Auto-generated by keynv init --yes\n${aliasLines}\n`);
    this.context.stdout.write(`keynv: wrote ${keynvEnvPath}\n`);

    // Write AGENTS.md
    try {
      const outcome = writeAiContext(root.path);
      if (outcome === 'created') this.context.stdout.write('keynv: wrote AGENTS.md\n');
    } catch {
      this.context.stdout.write('keynv: warning — could not write AGENTS.md.\n');
    }

    // Remove original .env files
    for (const f of envFiles) {
      unlinkSync(f.path);
      this.context.stdout.write(`keynv: removed ${f.name} (secrets migrated to vault).\n`);
    }

    this.context.stdout.write(
      'keynv: done. Use `keynv exec` to run commands with resolved secrets.\n',
    );
    return 0;
  }

  /**
   * Upload secrets to the vault and print the result. Shared between
   * runNonInteractive and runAutoScan.
   */
  async uploadSecrets(
    client: ApiClient,
    projectId: string,
    projectName: string,
    envName: string,
    secrets: Array<{ name: string; value: string; aliasKey: string }>,
  ): Promise<number> {
    let uploaded = 0;
    const failed: Array<{ name: string; reason: string }> = [];
    for (const s of secrets) {
      const alias = reference.buildAlias({
        project: projectName,
        environment: envName,
        key: s.aliasKey,
      });
      if (!alias) {
        failed.push({ name: s.name, reason: `invalid alias key: ${s.aliasKey}` });
        continue;
      }
      try {
        await client.request(`/v1/projects/${projectId}/secrets`, {
          method: 'POST',
          body: { env: envName, key: s.aliasKey, value: s.value },
        });
        uploaded++;
      } catch (err) {
        failed.push({ name: s.name, reason: err instanceof Error ? err.message : String(err) });
      }
    }
    this.context.stdout.write(
      `keynv: uploaded ${uploaded}/${secrets.length} secret(s) to ${projectName}.${envName}\n`,
    );
    if (failed.length > 0) {
      for (const f of failed) this.context.stderr.write(`  failed: ${f.name} — ${f.reason}\n`);
      return 1;
    }
    return 0;
  }
}
