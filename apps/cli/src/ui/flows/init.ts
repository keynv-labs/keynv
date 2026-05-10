/**
 * `keynv init` interactive flow. Migrates an existing project's
 * `.env` files into the keynv vault and writes a `.keynv.env`
 * mapping file alongside.
 *
 * v1 limitations (will be lifted when the server grows the right
 * endpoints):
 *   - All discovered `.env*` files merge into a single keynv env
 *     (suggested via .env's suffix, defaults to `dev`). Multi-env
 *     support requires a `POST /v1/projects/:id/environments`
 *     route the server doesn't have yet.
 *   - Secrets are uploaded sequentially, not transactionally. If
 *     one fails partway, the prior uploads stay; only the
 *     successful ones go into the .keynv.env we write.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAlias } from '@keynv/core';
import {
  cancel,
  confirm,
  intro,
  log,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from '@clack/prompts';
import type { ApiClient } from '../../client/http.js';
import { type EnvFileEntry, parseEnvFile } from '../../exec/envFile.js';
import {
  type EnvFileHit,
  findEnvFiles,
  findProjectRoot,
  hasExistingKeynvEnv,
  suggestedEnvForSuffix,
} from '../../init/detect.js';
import { classifyEntry, previewValue } from '../../init/heuristics.js';
import { applyWraps, planScriptWrap } from '../../init/scriptWrap.js';
import { UserCancelled, unwrap } from '../helpers/cancel.js';
import { listProjects } from '../helpers/pickProject.js';

export interface RunInitOptions {
  cwd: string;
  dryRun: boolean;
  noScripts: boolean;
}

export interface InitOutcome {
  exitCode: number;
}

interface MergedEntry {
  name: string;
  value: string;
  isAlias: boolean;
  /** First file (order of discovery) where this key appeared. */
  source: string;
  /** Line in `source`. */
  sourceLine: number;
  /** Files that re-declared the same key (later wins for value). */
  shadowedBy: string[];
}

export async function runInitFlow(client: ApiClient, opts: RunInitOptions): Promise<InitOutcome> {
  intro('keynv init');

  // 1. Project root + env file discovery -------------------------------------
  const root = findProjectRoot(opts.cwd);
  if (root === null) {
    cancel(
      "Couldn't find a project root (no package.json, pyproject.toml, Cargo.toml, go.mod, or .git anywhere up the tree). Run `keynv init` inside a project directory.",
    );
    return { exitCode: 1 };
  }
  if (root.packageJsonInvalid) {
    log.warn(`package.json at ${root.path} is not valid JSON — script wrapping will be skipped.`);
  }

  const envFiles = findEnvFiles(root.path);
  if (envFiles.length === 0 && !hasExistingKeynvEnv(root.path)) {
    log.info(
      `No .env files found in ${root.path}. There's nothing to migrate yet — create a .keynv.env by hand or run \`keynv exec\` once you have one.`,
    );
    outro('Nothing to do.');
    return { exitCode: 0 };
  }

  const intoExisting = hasExistingKeynvEnv(root.path);
  note(
    [
      `Project root: ${root.path}`,
      `Marker: ${root.marker}`,
      envFiles.length > 0
        ? `Found env files: ${envFiles.map((f) => f.name).join(', ')}`
        : 'Found env files: (none)',
      intoExisting ? 'Existing .keynv.env detected — will merge new entries in.' : '',
    ]
      .filter(Boolean)
      .join('\n'),
    'Detected',
  );

  // 2. Parse + merge all env files into one keyspace ------------------------
  const merged = mergeEnvFiles(envFiles);
  if (merged.length === 0) {
    log.info('All env files were empty (only comments/blanks). Nothing to upload.');
    outro('Done.');
    return { exitCode: 0 };
  }

  // 3. Pick keynv project (or create new) -----------------------------------
  const projectChoice = await pickOrCreateProject(client, root.suggestedName);
  if (projectChoice === null) {
    cancel('No project selected.');
    return { exitCode: 130 };
  }

  // 4. Pick the single keynv env all secrets land in ------------------------
  const envName = await pickEnvForUpload(client, projectChoice, envFiles);
  if (envName === null) {
    cancel('No environment selected.');
    return { exitCode: 130 };
  }

  // 5. Per-entry checklist: secret vs literal -------------------------------
  const choices = merged.map((e) => {
    const verdict = classifyEntry(e.name, e.value);
    const hint = verdict.hint || (e.isAlias ? 'looks like an alias literal' : 'no signal');
    const preview = e.isAlias ? e.value : previewValue(e.value, 32);
    return {
      name: e.name,
      value: e.value,
      isAlias: e.isAlias,
      verdict: verdict.verdict,
      label: `${e.name}  ${preview}`,
      hint,
      sourceLine: e.sourceLine,
      source: e.source,
    };
  });

  const initialSecretSelection = choices
    .filter((c) => c.verdict === 'secret' && !c.isAlias)
    .map((c) => c.name);

  const selectedSecretNames = unwrap(
    await multiselect({
      message: 'Mark which keys are secrets (vault-uploaded). Unchecked keys stay as literals.',
      options: choices.map((c) => ({
        value: c.name,
        label: c.label,
        hint: c.isAlias ? `${c.hint} — already aliased; will pass through` : c.hint,
      })),
      initialValues: initialSecretSelection,
      required: false,
    }),
  ) as string[];
  const selected = new Set(selectedSecretNames);

  // 6. Confirm package.json script wrap (optional) --------------------------
  let scriptWrapSelection: string[] = [];
  let scriptPlan = root.packageJsonScripts ? planScriptWrap(root.packageJsonScripts) : null;
  if (!opts.noScripts && scriptPlan && scriptPlan.recommended.length > 0) {
    const wrapAnswer = unwrap(
      await multiselect({
        message: 'Wrap package.json scripts with `keynv exec`? (recommended)',
        options: [
          ...scriptPlan.recommended.map((a) => ({
            value: a.name,
            label: `${a.name}  →  ${a.wrapped}`,
            hint: a.hint,
          })),
          ...scriptPlan.unknown.map((a) => ({
            value: a.name,
            label: `${a.name}  →  ${a.wrapped}`,
            hint: `unknown tool — opt in if you know it reads env`,
          })),
        ],
        initialValues: scriptPlan.recommended.map((a) => a.name),
        required: false,
      }),
    ) as string[];
    scriptWrapSelection = wrapAnswer;
  } else if (opts.noScripts) {
    scriptPlan = null;
  }

  // 7. Decide what to do with the original .env files -----------------------
  const envFileFateRaw = unwrap(
    await select({
      message: 'After upload, what about the original .env files?',
      options: [
        { value: 'delete', label: 'Delete (recommended — eliminates the leak vector)' },
        { value: 'gitignore', label: 'Keep but make sure .gitignore covers them' },
      ],
      initialValue: 'delete',
    }),
  ) as 'delete' | 'gitignore';

  // 8. Final confirm before any writes/uploads ------------------------------
  const planSummary = [
    `Project:          ${projectChoice.name}${projectChoice.created ? ' (will be created)' : ''}`,
    `Environment:      ${envName}`,
    `Secrets to vault: ${selected.size}`,
    `Literals in file: ${merged.length - selected.size}`,
    `Script wraps:     ${scriptWrapSelection.length}`,
    `Original .env:    ${envFileFateRaw === 'delete' ? 'delete' : 'keep + gitignore'}`,
    opts.dryRun ? 'Dry-run: no changes will be made.' : '',
  ]
    .filter(Boolean)
    .join('\n');
  note(planSummary, 'About to apply');

  const proceed = unwrap(await confirm({ message: 'Proceed?', initialValue: true }));
  if (!proceed) {
    cancel('Aborted.');
    return { exitCode: 130 };
  }

  if (opts.dryRun) {
    outro('Dry-run complete — no changes were made.');
    return { exitCode: 0 };
  }

  // 9. Apply --------------------------------------------------------------
  let projectId: string;
  if (projectChoice.created) {
    const s = spinner();
    s.start(`Creating project "${projectChoice.name}"`);
    try {
      const created = await client.request<{ id: string; name: string }>('/v1/projects', {
        method: 'POST',
        body: {
          name: projectChoice.name,
          environments: [{ name: envName, tier: 'non-production', require_approval: false }],
        },
      });
      projectId = created.id;
      s.stop(`Created project ${created.name}`);
    } catch (err) {
      s.error(`Failed to create project: ${err instanceof Error ? err.message : String(err)}`);
      return { exitCode: 1 };
    }
  } else {
    projectId = projectChoice.id;
  }

  // 10. Upload secrets sequentially; track which succeed --------------------
  const uploaded: Array<{ name: string; aliasLiteral: string }> = [];
  const failed: Array<{ name: string; reason: string }> = [];
  if (selected.size > 0) {
    const s = spinner();
    s.start(`Uploading ${selected.size} secrets`);
    let i = 0;
    for (const entry of merged) {
      if (!selected.has(entry.name)) continue;
      i++;
      s.message(`Uploading (${i}/${selected.size}) ${entry.name}`);
      const aliasKey = entry.name.toLowerCase().replace(/_/g, '-');
      try {
        await client.request(`/v1/projects/${projectId}/secrets`, {
          method: 'POST',
          body: { env: envName, key: aliasKey, value: entry.value },
        });
        const alias = buildAlias({ project: projectChoice.name, environment: envName, key: aliasKey });
        if (alias === null) {
          failed.push({
            name: entry.name,
            reason: `produced an invalid alias for project=${projectChoice.name} env=${envName} key=${aliasKey}`,
          });
        } else {
          uploaded.push({ name: entry.name, aliasLiteral: alias.literal });
        }
      } catch (err) {
        failed.push({ name: entry.name, reason: err instanceof Error ? err.message : String(err) });
      }
    }
    if (failed.length === 0) {
      s.stop(`Uploaded ${uploaded.length} secrets`);
    } else {
      s.error(`${uploaded.length}/${selected.size} uploaded; ${failed.length} failed`);
      for (const f of failed) log.warn(`  ${f.name}: ${f.reason}`);
    }
  }

  // 11. Compose .keynv.env --------------------------------------------------
  const literals = merged.filter((e) => !selected.has(e.name));
  const successUploads = new Map(uploaded.map((u) => [u.name, u.aliasLiteral]));
  const keynvEnvPath = join(root.path, '.keynv.env');
  let writtenLines: string[];
  try {
    writtenLines = composeKeynvEnv({
      uploadedAliases: successUploads,
      literals,
      mergeWithExisting: intoExisting ? readFileSync(keynvEnvPath, 'utf8') : null,
    });
    writeFileSync(keynvEnvPath, `${writtenLines.join('\n')}\n`);
    log.success(
      `${intoExisting ? 'Updated' : 'Wrote'} ${keynvEnvPath} (${successUploads.size + literals.length} entries)`,
    );
  } catch (err) {
    log.error(`Failed to write .keynv.env: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 1 };
  }

  // 12. Apply script wraps ---------------------------------------------------
  if (scriptWrapSelection.length > 0 && root.packageJsonScripts) {
    try {
      updatePackageJsonScripts(
        join(root.path, 'package.json'),
        root.packageJsonScripts,
        scriptWrapSelection,
      );
      log.success(`Wrapped ${scriptWrapSelection.length} script(s) in package.json`);
    } catch (err) {
      log.warn(
        `Could not update package.json scripts: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 13. Handle original .env files ------------------------------------------
  if (envFileFateRaw === 'delete') {
    for (const f of envFiles) {
      try {
        unlinkSync(f.path);
        log.success(`Removed ${f.name}`);
      } catch (err) {
        log.warn(`Could not remove ${f.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    const gitignorePath = join(root.path, '.gitignore');
    try {
      ensureGitignoreEntries(gitignorePath, envFiles.map((f) => f.name));
      log.success(`Updated .gitignore (${envFiles.length} entries ensured)`);
    } catch (err) {
      log.warn(`Could not update .gitignore: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 14. Summary -------------------------------------------------------------
  outro(
    failed.length > 0
      ? `Done with ${failed.length} failure(s) — see warnings above.`
      : `Done. Try: ${scriptWrapSelection.includes('dev') ? 'npm run dev' : 'keynv exec -- <your command>'}`,
  );
  return { exitCode: failed.length > 0 ? 1 : 0 };
}

// -------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------

function mergeEnvFiles(files: EnvFileHit[]): MergedEntry[] {
  const map = new Map<string, MergedEntry>();
  for (const f of files) {
    let entries: EnvFileEntry[];
    try {
      entries = parseEnvFile(readFileSync(f.path, 'utf8'), f.path);
    } catch (err) {
      log.warn(`${f.name}: ${err instanceof Error ? err.message : String(err)} — skipping file`);
      continue;
    }
    for (const e of entries) {
      const existing = map.get(e.name);
      if (existing) {
        existing.shadowedBy.push(f.name);
        existing.value = e.value;
        existing.isAlias = e.isAlias;
      } else {
        map.set(e.name, {
          name: e.name,
          value: e.value,
          isAlias: e.isAlias,
          source: f.name,
          sourceLine: e.line,
          shadowedBy: [],
        });
      }
    }
  }
  return [...map.values()];
}

interface ProjectChoice {
  id: string;
  name: string;
  created: boolean;
}

async function pickOrCreateProject(
  client: ApiClient,
  suggestedName: string,
): Promise<ProjectChoice | null> {
  const projects = await listProjects(client);
  const value = unwrap(
    await select({
      message: 'Use which keynv project?',
      options: [
        { value: '__new', label: `+ Create new: "${suggestedName}"` },
        ...projects.map((p) => ({ value: p.id, label: p.name, hint: p.id })),
      ],
    }),
  );
  if (value === '__new') {
    const name = unwrap(
      await text({
        message: 'Project name',
        initialValue: suggestedName,
        validate: (v) =>
          v && /^[a-z0-9][a-z0-9-]{0,47}$/.test(v)
            ? undefined
            : 'lowercase letters, digits, dashes; up to 48 chars',
      }),
    ) as string;
    return { id: '', name, created: true };
  }
  const match = projects.find((p) => p.id === value);
  if (!match) return null;
  return { id: match.id, name: match.name, created: false };
}

async function pickEnvForUpload(
  client: ApiClient,
  project: ProjectChoice,
  envFiles: EnvFileHit[],
): Promise<string | null> {
  // Default suggestion: the suffix of the first env file (plain .env → dev).
  const firstSuffix = envFiles[0]?.suffix ?? null;
  const suggested = suggestedEnvForSuffix(firstSuffix);

  if (project.created) {
    // For a brand-new project we'll create the env in the same call,
    // so any name the user picks is fine.
    const value = unwrap(
      await text({
        message: 'Environment to create',
        initialValue: suggested,
        validate: (v) =>
          v && /^[a-z0-9][a-z0-9-]{0,23}$/.test(v)
            ? undefined
            : 'lowercase letters, digits, dashes; up to 24 chars',
      }),
    );
    return value as string;
  }

  // Existing project: must pick from envs the project already has.
  // The server doesn't yet support adding envs to an existing project.
  const detail = await client.request<{
    environments: Array<{ name: string; tier: string }>;
  }>(`/v1/projects/${project.id}`);
  if (detail.environments.length === 0) {
    cancel(
      `Project "${project.name}" has no environments yet, and we can't add one from init in this version. Create one with \`keynv project create\` (or pick a different project).`,
    );
    return null;
  }
  if (detail.environments.length === 1) {
    return detail.environments[0]?.name ?? null;
  }
  const value = unwrap(
    await select({
      message: 'Upload to which environment?',
      options: detail.environments.map((e) => ({
        value: e.name,
        label: e.name,
        hint: e.tier,
      })),
      initialValue: detail.environments.find((e) => e.name === suggested)?.name,
    }),
  );
  return value as string;
}

interface ComposeOpts {
  uploadedAliases: Map<string, string>;
  literals: MergedEntry[];
  mergeWithExisting: string | null;
}

function composeKeynvEnv(opts: ComposeOpts): string[] {
  const { uploadedAliases, literals, mergeWithExisting } = opts;
  const lines: string[] = [];
  if (mergeWithExisting !== null) {
    // Preserve existing content; new entries are appended below a marker.
    const trimmed = mergeWithExisting.replace(/\n+$/, '');
    if (trimmed.length > 0) {
      lines.push(...trimmed.split('\n'));
      lines.push('');
    }
    lines.push(`# >>> keynv init  ${new Date().toISOString().slice(0, 10)} >>>`);
  } else {
    lines.push('# .keynv.env — alias references to vault secrets.');
    lines.push('# Safe to commit: this file contains references, not values.');
    lines.push('# Auto-loaded by `keynv exec`. See https://keynv.dev/docs/keynv-env');
    lines.push('');
  }
  if (uploadedAliases.size > 0) {
    lines.push('# Vault-resolved (real values live on the keynv server)');
    for (const [name, alias] of uploadedAliases) {
      lines.push(`${name}=${alias}`);
    }
  }
  if (literals.length > 0) {
    if (uploadedAliases.size > 0) lines.push('');
    lines.push('# Plain literals (passed through unchanged)');
    for (const e of literals) {
      const value = needsQuoting(e.value) ? `"${e.value.replace(/"/g, '\\"')}"` : e.value;
      lines.push(`${e.name}=${value}`);
    }
  }
  if (mergeWithExisting !== null) {
    lines.push(`# <<< keynv init <<<`);
  }
  return lines;
}

function needsQuoting(value: string): boolean {
  return /\s/.test(value) || value.includes('#') || value.length === 0;
}

function updatePackageJsonScripts(
  path: string,
  originalScripts: Record<string, string>,
  selectedNames: ReadonlyArray<string>,
): void {
  const raw = readFileSync(path, 'utf8');
  // Detect formatting (indent size + trailing newline) so we don't
  // upend prettier-managed package.json files.
  const indentMatch = raw.match(/^([ \t]+)"/m);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const trailingNewline = raw.endsWith('\n');
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string>; [k: string]: unknown };
  const updated = applyWraps(originalScripts, selectedNames);
  pkg.scripts = updated;
  // Re-serialize with the detected indent.
  const out = JSON.stringify(pkg, null, indent);
  writeFileSync(path, trailingNewline ? `${out}\n` : out);
}

function ensureGitignoreEntries(path: string, basenames: ReadonlyArray<string>): void {
  let existing = '';
  if (existsSync(path)) existing = readFileSync(path, 'utf8');
  const existingLines = new Set(existing.split('\n').map((l) => l.trim()));
  const toAdd = basenames.filter((n) => !existingLines.has(n));
  if (toAdd.length === 0) return;
  const sep = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  const block = ['', '# added by keynv init', ...toAdd, ''].join('\n');
  writeFileSync(path, `${existing}${sep}${block}`);
}

// Re-export so the InitCommand can detect plan-mode aborts cleanly.
export { UserCancelled };
