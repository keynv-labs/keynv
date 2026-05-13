/**
 * `keynv init` interactive flow. Migrates an existing project's
 * `.env` files into the keynv vault and writes a `.keynv.env`
 * mapping file alongside.
 *
 * Multi-env support (rc.10):
 * Each discovered `.env*` file gets mapped to a keynv environment
 * (auto-suggested from suffix; user can override). Secrets within a
 * file go into that env's namespace in the vault. The `.keynv.env`
 * we write only contains the *default* env's aliases — usually dev
 * — because that's what `pnpm dev` will resolve via `keynv exec`.
 * Production secrets land in the vault but stay out of the local
 * `.keynv.env` (they get accessed at deploy time via a separate
 * file or `KEYNV_ENV_FILE`).
 */
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { buildAlias } from '@keynv/core';
import type { ApiClient } from '../../client/http.js';
import { type EnvFileEntry, parseEnvFile } from '../../exec/envFile.js';
import { writeAiContext } from '../../init/aiContext.js';
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
  /** First file (in mapping order) where this key appeared inside its env. */
  source: string;
  /** Line in `source`. */
  sourceLine: number;
  /** Files within the same env that re-declared this key (later wins). */
  shadowedBy: string[];
}

interface FileEnvAssignment {
  file: EnvFileHit;
  envName: string;
}

interface ProjectChoice {
  id: string;
  name: string;
  created: boolean;
  /** Envs this project already has on the server (empty for new project). */
  existingEnvs: Array<{ name: string; tier: 'production' | 'non-production' }>;
}

export async function runInitFlow(client: ApiClient, opts: RunInitOptions): Promise<InitOutcome> {
  intro('keynv init');

  // 1. Discover project root + env files ------------------------------------
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
  const intoExisting = hasExistingKeynvEnv(root.path);
  if (envFiles.length === 0 && !intoExisting) {
    log.info(
      `No .env files found in ${root.path}. There's nothing to migrate yet — create a .keynv.env by hand or run \`keynv exec\` once you have one.`,
    );
    outro('Nothing to do.');
    return { exitCode: 0 };
  }
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

  // 2. Pick (or create) the keynv project -----------------------------------
  const projectChoice = await pickOrCreateProject(client, root.suggestedName);
  if (projectChoice === null) {
    cancel('No project selected.');
    return { exitCode: 130 };
  }

  // 3. Map each .env file to a keynv environment ----------------------------
  const fileMapping = await pickFileEnvMapping(envFiles, projectChoice);
  if (fileMapping === null) {
    cancel('No env mapping selected.');
    return { exitCode: 130 };
  }

  // Distinct env names we're going to need on the server.
  const distinctEnvs = [...new Set(fileMapping.map((m) => m.envName))];

  // 4. Parse files + merge per-env keyspaces --------------------------------
  const perEnv = parseAndMergePerEnv(fileMapping);

  // 5. Filter framework/shell-managed entries (NODE_ENV, PORT, …).
  const skipped: Array<{ env: string; entry: MergedEntry }> = [];
  for (const env of distinctEnvs) {
    const before = perEnv.get(env) ?? [];
    const kept: MergedEntry[] = [];
    for (const e of before) {
      if (classifyEntry(e.name, e.value).verdict === 'skip') {
        skipped.push({ env, entry: e });
      } else {
        kept.push(e);
      }
    }
    perEnv.set(env, kept);
  }
  if (skipped.length > 0) {
    const names = [...new Set(skipped.map((s) => s.entry.name))];
    log.info(
      `Skipped ${skipped.length} framework/shell-managed entr${skipped.length === 1 ? 'y' : 'ies'}: ${names.join(', ')}`,
    );
  }

  // Surface intra-env shadowed keys so the user knows last-wins ran.
  for (const env of distinctEnvs) {
    const shadowed = (perEnv.get(env) ?? []).filter((e) => e.shadowedBy.length > 0);
    if (shadowed.length === 0) continue;
    const detail = shadowed
      .map((e) => `  [${env}] ${e.name}: ${e.source} → ${e.shadowedBy[e.shadowedBy.length - 1]}`)
      .join('\n');
    log.warn(
      `Some keys appear in multiple env files mapped to the same env; using the last value (dotenv convention):\n${detail}`,
    );
  }

  const totalEntries = [...perEnv.values()].reduce((n, arr) => n + arr.length, 0);
  if (totalEntries === 0) {
    log.info(
      'All env files were empty or only contained framework-managed vars. Nothing to upload.',
    );
    outro('Done.');
    return { exitCode: 0 };
  }

  // 6. Per-entry secret-or-literal checklist (flat across envs) -------------
  interface Choice {
    composite: string; // `${env}|${name}`
    env: string;
    name: string;
    value: string;
    isAlias: boolean;
    verdict: ReturnType<typeof classifyEntry>['verdict'];
    label: string;
    hint: string;
  }
  const choices: Choice[] = [];
  for (const env of distinctEnvs) {
    for (const e of perEnv.get(env) ?? []) {
      const c = classifyEntry(e.name, e.value);
      const hint = c.hint || (e.isAlias ? 'looks like an alias literal' : 'no signal');
      const preview = e.isAlias ? e.value : previewValue(e.value, 28);
      const envTag = distinctEnvs.length > 1 ? `[${env}] ` : '';
      choices.push({
        composite: `${env}|${e.name}`,
        env,
        name: e.name,
        value: e.value,
        isAlias: e.isAlias,
        verdict: c.verdict,
        label: `${envTag}${e.name}  ${preview}`,
        hint,
      });
    }
  }

  const initialSecretSelection = choices
    .filter((c) => c.verdict === 'secret' && !c.isAlias)
    .map((c) => c.composite);

  const selectedComposites = unwrap(
    await multiselect({
      message: 'Mark which keys are secrets (vault-uploaded). Unchecked keys stay as literals.',
      options: choices.map((c) => ({
        value: c.composite,
        label: c.label,
        hint: c.isAlias ? `${c.hint} — already aliased; will pass through` : c.hint,
      })),
      initialValues: initialSecretSelection,
      required: false,
    }),
  ) as string[];
  const selected = new Set(selectedComposites);

  // 7. Default env for .keynv.env content -----------------------------------
  // The .keynv.env we write at the project root is loaded by `keynv exec`
  // when the user runs (typically) `pnpm dev`. So the default env should
  // be the one matching local development.
  const defaultEnv = pickDefaultEnv(distinctEnvs);

  // 8. Script wrap plan (no prompt) -----------------------------------------
  let scriptWrapSelection: string[] = [];
  const scriptPlan = root.packageJsonScripts ? planScriptWrap(root.packageJsonScripts) : null;
  if (!opts.noScripts && scriptPlan && scriptPlan.recommended.length > 0) {
    scriptWrapSelection = scriptPlan.recommended.map((a) => a.name);
  }

  // 9. Final confirm --------------------------------------------------------
  const perEnvCounts = distinctEnvs
    .map((env) => {
      const entries = perEnv.get(env) ?? [];
      const sec = entries.filter((e) => selected.has(`${env}|${e.name}`)).length;
      const lit = entries.length - sec;
      return `  ${env}: ${sec} secrets, ${lit} literals${env === defaultEnv ? ' (default — written to .keynv.env)' : ''}`;
    })
    .join('\n');
  const planSummary = [
    `Project:           ${projectChoice.name}${projectChoice.created ? ' (will be created)' : ''}`,
    `Environments:      ${distinctEnvs.join(', ')}`,
    'Per-env breakdown:',
    perEnvCounts,
    `Script wraps:      ${scriptWrapSelection.length}`,
    'Original .env:     delete after upload',
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

  // 10. Ensure project + envs exist on the server ---------------------------
  const projectId = await ensureProjectAndEnvs(client, projectChoice, distinctEnvs);
  if (projectId === null) return { exitCode: 1 };

  // 11. Upload secrets per env ----------------------------------------------
  // Tracking per env so we can compose .keynv.env from defaultEnv only.
  const uploadedByEnv = new Map<string, Map<string, string>>(); // env → name → aliasLiteral
  const failed: Array<{ env: string; name: string; reason: string }> = [];
  const totalToUpload = selected.size;
  if (totalToUpload > 0) {
    const s = spinner();
    s.start(`Uploading ${totalToUpload} secret${totalToUpload === 1 ? '' : 's'}`);
    let i = 0;
    for (const env of distinctEnvs) {
      const envUploaded = new Map<string, string>();
      uploadedByEnv.set(env, envUploaded);
      for (const e of perEnv.get(env) ?? []) {
        if (!selected.has(`${env}|${e.name}`)) continue;
        i++;
        s.message(`Uploading (${i}/${totalToUpload}) [${env}] ${e.name}`);
        const aliasKey = e.name.toLowerCase().replace(/_/g, '-');
        try {
          await client.request(`/v1/projects/${projectId}/secrets`, {
            method: 'POST',
            body: { env, key: aliasKey, value: e.value },
          });
          const alias = buildAlias({
            project: projectChoice.name,
            environment: env,
            key: aliasKey,
          });
          if (alias === null) {
            failed.push({
              env,
              name: e.name,
              reason: `produced an invalid alias for project=${projectChoice.name} env=${env} key=${aliasKey}`,
            });
          } else {
            envUploaded.set(e.name, alias.literal);
          }
        } catch (err) {
          failed.push({
            env,
            name: e.name,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    if (failed.length === 0) {
      s.stop(`Uploaded ${totalToUpload} secret${totalToUpload === 1 ? '' : 's'}`);
    } else {
      s.error(
        `${totalToUpload - failed.length}/${totalToUpload} uploaded; ${failed.length} failed`,
      );
      for (const f of failed) log.warn(`  [${f.env}] ${f.name}: ${f.reason}`);
    }
  }

  // 12. Compose .keynv.env from the default env's results -------------------
  const defaultUploaded = uploadedByEnv.get(defaultEnv) ?? new Map<string, string>();
  const defaultLiterals = (perEnv.get(defaultEnv) ?? []).filter(
    (e) => !selected.has(`${defaultEnv}|${e.name}`),
  );
  const keynvEnvPath = join(root.path, '.keynv.env');
  try {
    const lines = composeKeynvEnv({
      uploadedAliases: defaultUploaded,
      literals: defaultLiterals,
      mergeWithExisting: intoExisting ? readFileSync(keynvEnvPath, 'utf8') : null,
    });
    writeFileSync(keynvEnvPath, `${lines.join('\n')}\n`);
    log.success(
      `${intoExisting ? 'Updated' : 'Wrote'} ${keynvEnvPath} (${defaultUploaded.size + defaultLiterals.length} entries from "${defaultEnv}")`,
    );
  } catch (err) {
    log.error(`Failed to write .keynv.env: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 1 };
  }

  // 13. AGENTS.md (always) ---------------------------------------------------
  try {
    const outcome = writeAiContext(root.path);
    if (outcome === 'created') log.success('Wrote AGENTS.md (so AI agents understand keynv)');
    else if (outcome === 'updated') log.success('Refreshed keynv section in AGENTS.md');
    else if (outcome === 'appended') log.success('Appended keynv section to AGENTS.md');
  } catch (err) {
    log.warn(`Could not write AGENTS.md: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 14. Apply script wraps ---------------------------------------------------
  if (scriptWrapSelection.length > 0 && root.packageJsonScripts) {
    try {
      updatePackageJsonScripts(
        join(root.path, 'package.json'),
        root.packageJsonScripts,
        scriptWrapSelection,
      );
      log.success(
        `Wrapped ${scriptWrapSelection.length} script${scriptWrapSelection.length === 1 ? '' : 's'} in package.json`,
      );
    } catch (err) {
      log.warn(
        `Could not update package.json scripts: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 15. Remove the original .env files --------------------------------------
  for (const f of envFiles) {
    try {
      unlinkSync(f.path);
      log.success(`Removed ${f.name}`);
    } catch (err) {
      log.warn(`Could not remove ${f.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 16. Mention non-default envs so the user knows their secrets are
  // safely in the vault even though `.keynv.env` only references the
  // default. They'll need a separate file or a deploy-time `keynv
  // exec --from .keynv.<env>.env` to use them.
  const otherEnvs = distinctEnvs.filter((e) => e !== defaultEnv);
  if (otherEnvs.length > 0) {
    const lines = otherEnvs.map((env) => {
      const count = uploadedByEnv.get(env)?.size ?? 0;
      return `  ${env}: ${count} secret${count === 1 ? '' : 's'} in vault (use \`keynv exec --from .keynv.${env}.env -- <cmd>\` after creating that file)`;
    });
    note(lines.join('\n'), 'Secrets in other envs');
  }

  // 17. Summary -------------------------------------------------------------
  outro(
    failed.length > 0
      ? `Done with ${failed.length} failure(s) — see warnings above.`
      : `Done. Try: ${scriptWrapSelection.includes('dev') ? 'pnpm dev' : 'keynv exec -- <your command>'}`,
  );
  return { exitCode: failed.length > 0 ? 1 : 0 };
}

// -------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------

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
    return { id: '', name, created: true, existingEnvs: [] };
  }
  const match = projects.find((p) => p.id === value);
  if (!match) return null;
  // Fetch env list so the file→env picker can show what already exists.
  const detail = await client.request<{
    environments: Array<{ name: string; tier: 'production' | 'non-production' }>;
  }>(`/v1/projects/${match.id}`);
  return {
    id: match.id,
    name: match.name,
    created: false,
    existingEnvs: detail.environments,
  };
}

/**
 * For each detected env file, decide which keynv environment its
 * secrets land in. Auto-suggests from the filename suffix; users
 * can override (or pick "+ create new env"). Returns null if the
 * user cancels at any point.
 *
 * Single-file projects skip the prompt entirely and use the
 * suffix-suggested env.
 */
async function pickFileEnvMapping(
  files: EnvFileHit[],
  project: ProjectChoice,
): Promise<FileEnvAssignment[] | null> {
  if (files.length === 0) return [];

  // Build the picker option set for the project.
  // For new projects: just suggested names (free text via "+ create").
  // For existing: existing envs + "+ create new".
  const existingEnvNames = new Set(project.existingEnvs.map((e) => e.name));

  // Single file: no prompt — auto-suggest.
  if (files.length === 1) {
    const onlyFile = files[0];
    if (!onlyFile) return [];
    const suggested = suggestedEnvForSuffix(onlyFile.suffix);
    return [{ file: onlyFile, envName: suggested }];
  }

  // Multi-file: per-file picker.
  const assignments: FileEnvAssignment[] = [];
  for (const f of files) {
    const suggested = suggestedEnvForSuffix(f.suffix);
    const opts: Array<{ value: string; label: string; hint?: string }> = [];

    // Suggested env first (existing or fresh)
    opts.push({
      value: suggested,
      label: suggested,
      hint: existingEnvNames.has(suggested)
        ? 'existing env'
        : project.created
          ? 'will be created with project'
          : 'will be added to project',
    });

    // Other existing envs not equal to suggested
    for (const e of project.existingEnvs) {
      if (e.name === suggested) continue;
      opts.push({ value: e.name, label: e.name, hint: e.tier });
    }

    opts.push({ value: '__custom', label: '+ Custom env name…' });

    let envName = unwrap(
      await select({
        message: `Map ${f.name} to which keynv env?`,
        options: opts,
        initialValue: suggested,
      }),
    ) as string;

    if (envName === '__custom') {
      envName = unwrap(
        await text({
          message: 'New env name',
          validate: (v) =>
            v && /^[a-z0-9][a-z0-9-]{0,23}$/.test(v)
              ? undefined
              : 'lowercase letters, digits, dashes; up to 24 chars',
        }),
      ) as string;
    }
    assignments.push({ file: f, envName });
  }
  return assignments;
}

/**
 * Parse each file and merge entries into per-env keyspaces. Within
 * one env, dotenv last-wins applies across the files mapped to it.
 */
function parseAndMergePerEnv(mapping: FileEnvAssignment[]): Map<string, MergedEntry[]> {
  // env → name → MergedEntry
  const acc = new Map<string, Map<string, MergedEntry>>();
  for (const { file, envName } of mapping) {
    let entries: EnvFileEntry[];
    try {
      entries = parseEnvFile(readFileSync(file.path, 'utf8'), file.path);
    } catch (err) {
      log.warn(`${file.name}: ${err instanceof Error ? err.message : String(err)} — skipping file`);
      continue;
    }
    let envMap = acc.get(envName);
    if (!envMap) {
      envMap = new Map<string, MergedEntry>();
      acc.set(envName, envMap);
    }
    for (const e of entries) {
      const existing = envMap.get(e.name);
      if (existing) {
        existing.shadowedBy.push(file.name);
        existing.value = e.value;
        existing.isAlias = e.isAlias;
      } else {
        envMap.set(e.name, {
          name: e.name,
          value: e.value,
          isAlias: e.isAlias,
          source: file.name,
          sourceLine: e.line,
          shadowedBy: [],
        });
      }
    }
  }
  // flatten inner Maps to arrays for the caller
  const out = new Map<string, MergedEntry[]>();
  for (const [env, m] of acc) out.set(env, [...m.values()]);
  return out;
}

/**
 * Decide which env's aliases get written into the cwd `.keynv.env`.
 * Heuristic: prefer 'dev' when present (matches the typical local
 * dev workflow), otherwise the first env in iteration order.
 */
function pickDefaultEnv(envs: ReadonlyArray<string>): string {
  if (envs.length === 0) return 'dev';
  if (envs.includes('dev')) return 'dev';
  return envs[0] as string;
}

/**
 * Make sure `projectChoice` exists on the server with all the envs
 * it needs. For a brand-new project, creates it with every distinct
 * env upfront. For an existing project, POSTs each missing env
 * individually. Returns the project id, or null on failure (with
 * an error already logged).
 */
async function ensureProjectAndEnvs(
  client: ApiClient,
  projectChoice: ProjectChoice,
  distinctEnvs: ReadonlyArray<string>,
): Promise<string | null> {
  if (projectChoice.created) {
    const s = spinner();
    s.start(`Creating project "${projectChoice.name}" with ${distinctEnvs.length} env(s)`);
    try {
      const created = await client.request<{ id: string; name: string }>('/v1/projects', {
        method: 'POST',
        body: {
          name: projectChoice.name,
          environments: distinctEnvs.map((name) => envBodyFor(name)),
        },
      });
      s.stop(`Created project ${created.name}`);
      return created.id;
    } catch (err) {
      s.error(`Failed to create project: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // Existing project — figure out which envs are missing.
  const existing = new Set(projectChoice.existingEnvs.map((e) => e.name));
  const missing = distinctEnvs.filter((e) => !existing.has(e));
  if (missing.length === 0) return projectChoice.id;

  const s = spinner();
  s.start(`Adding ${missing.length} missing env(s) to project "${projectChoice.name}"`);
  for (const envName of missing) {
    try {
      await client.request(`/v1/projects/${projectChoice.id}/environments`, {
        method: 'POST',
        body: envBodyFor(envName),
      });
    } catch (err) {
      s.error(
        `Failed to add env "${envName}": ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
  s.stop(`Added env(s): ${missing.join(', ')}`);
  return projectChoice.id;
}

/**
 * Default tier + approval choice for a freshly-created env. Names
 * that look like production (`prod`, `production`) get the
 * production tier with approval-required; everything else stays
 * non-production with no approval. Users who need a different
 * setting can edit the env later (post-init UX TBD).
 */
function envBodyFor(name: string): {
  name: string;
  tier: 'production' | 'non-production';
  require_approval: boolean;
} {
  const isProd = name === 'prod' || name === 'production';
  return {
    name,
    tier: isProd ? 'production' : 'non-production',
    require_approval: isProd,
  };
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
    const normalized = mergeWithExisting.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const trimmed = normalized.replace(/\n+$/, '');
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
    lines.push('# <<< keynv init <<<');
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
  const indentMatch = raw.match(/^([ \t]+)"/m);
  const indent = indentMatch ? indentMatch[1] : '  ';
  const trailingNewline = raw.endsWith('\n');
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string>; [k: string]: unknown };
  const updated = applyWraps(originalScripts, selectedNames);
  pkg.scripts = updated;
  const out = JSON.stringify(pkg, null, indent);
  writeFileSync(path, trailingNewline ? `${out}\n` : out);
}

// Re-export so the InitCommand can detect plan-mode aborts cleanly.
export { UserCancelled };
