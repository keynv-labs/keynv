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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
import { reference } from '@keynv/core';
import type { ApiClient } from '../../client/http.js';
import { parseEnvFile } from '../../exec/envFile.js';
import { writeAiContext } from '../../init/ai-context.js';
import { backupEnvFile } from '../../init/backup.js';
import {
  type ResolvedEntry,
  type SourceEntry,
  planVaultKeys,
} from '../../init/collision.js';
import {
  type EnvFileHit,
  findEnvFilesRecursive,
  findProjectRoot,
  hasExistingKeynvEnv,
  suggestedEnvForSuffix,
} from '../../init/detect.js';
import { classifyEntry, maskedPreview, previewValue } from '../../init/heuristics.js';
import { applyWraps, planScriptWrap } from '../../init/script-wrap.js';
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

interface FileEnvAssignment {
  file: EnvFileHit;
  envName: string;
}

/**
 * Render an env-file path relative to the scan root for log/UI
 * display. Files at the root show just their basename; nested files
 * show `apps/api/.env` style.
 */
function displayName(file: EnvFileHit): string {
  return file.relativeDir === '' ? file.name : `${file.relativeDir}/${file.name}`;
}

/**
 * Render a file path relative to the project root, with POSIX
 * separators so logs stay portable.
 */
function relFromRoot(rootPath: string, absPath: string): string {
  const r = relative(rootPath, absPath);
  if (r === '') return '.';
  return r.split(/[\\/]/).filter(Boolean).join('/');
}

interface ProjectChoice {
  id: string;
  name: string;
  created: boolean;
  /** Envs this project already has on the server (empty for new project). */
  existingEnvs: Array<{ name: string; tier: 'production' | 'non-production' }>;
}

export async function runInitFlow(client: ApiClient, opts: RunInitOptions): Promise<InitOutcome> {
  intro('Set up this project');

  // 1. Discover project root + env files ------------------------------------
  const root = findProjectRoot(opts.cwd);
  if (root === null) {
    cancel(
      'Couldn\'t find a project root (no package.json, pyproject.toml, Cargo.toml, go.mod, or .git anywhere up the tree). Run `keynv` inside a project directory and choose "Set up this project".',
    );
    return { exitCode: 1 };
  }
  if (root.packageJsonInvalid) {
    log.warn(`package.json at ${root.path} is not valid JSON — script wrapping will be skipped.`);
  }
  const envFiles = findEnvFilesRecursive(root.path);
  const intoExisting = hasExistingKeynvEnv(root.path);
  if (envFiles.length === 0 && !intoExisting) {
    log.info(
      `No .env files found in ${root.path} (scanned root and subdirectories). There's nothing to migrate yet — create a .keynv.env by hand or run \`keynv exec\` once you have one.`,
    );
    outro('Nothing to do.');
    return { exitCode: 0 };
  }
  note(
    [
      `Project root: ${root.path}`,
      `Marker: ${root.marker}`,
      envFiles.length > 0
        ? `Found env files:\n${envFiles.map((f) => `  ${displayName(f)}`).join('\n')}`
        : 'Found env files: (none)',
      intoExisting ? 'Existing root .keynv.env detected — will merge new entries in.' : '',
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

  // 4. Parse each file into SourceEntry list, filtering framework/shell vars.
  const allSources: SourceEntry[] = [];
  const skipped: Array<{ env: string; name: string }> = [];
  for (const { file, envName } of fileMapping) {
    let parsed: ReturnType<typeof parseEnvFile>;
    try {
      parsed = parseEnvFile(readFileSync(file.path, 'utf8'), file.path);
    } catch (err) {
      log.warn(
        `${displayName(file)}: ${err instanceof Error ? err.message : String(err)} — skipping file`,
      );
      continue;
    }
    for (const e of parsed) {
      if (classifyEntry(e.name, e.value).verdict === 'skip') {
        skipped.push({ env: envName, name: e.name });
        continue;
      }
      allSources.push({
        file,
        envName,
        name: e.name,
        value: e.value,
        isAlias: e.isAlias,
        line: e.line,
      });
    }
  }
  if (skipped.length > 0) {
    const names = [...new Set(skipped.map((s) => s.name))];
    log.info(
      `Skipped ${skipped.length} framework/shell-managed entr${skipped.length === 1 ? 'y' : 'ies'}: ${names.join(', ')}`,
    );
  }

  // 5. Plan vault keys: intra-dir last-wins + cross-dir collision handling.
  const plan = planVaultKeys(allSources);

  if (plan.shadowed.length > 0) {
    const detail = plan.shadowed
      .map(
        (s) =>
          `  [${s.envName}] ${relFromRoot(root.path, s.containingDir)}/${s.localKey}: ${s.earlierFiles.join(', ')} -> ${s.laterFile}`,
      )
      .join('\n');
    log.warn(
      `Some keys appear in multiple env files in the same directory mapped to the same env; using the last value (dotenv convention):\n${detail}`,
    );
  }
  if (plan.merged.length > 0) {
    const detail = plan.merged
      .map(
        (m) =>
          `  [${m.envName}] ${m.key}: same value across ${m.sources.map((s) => displayName(s)).join(', ')} -> one vault entry shared`,
      )
      .join('\n');
    log.info(`Merged cross-app duplicates into a single vault entry:\n${detail}`);
  }
  if (plan.renamed.length > 0) {
    // One rename note per source; group by localKey for readable output.
    const byLocal = new Map<string, typeof plan.renamed>();
    for (const r of plan.renamed) {
      const k = `${r.envName}|${r.localKey}`;
      const arr = byLocal.get(k) ?? [];
      arr.push(r);
      byLocal.set(k, arr);
    }
    const detail = [...byLocal.values()]
      .map((group) => {
        const head = group[0];
        if (!head) return '';
        const sources = group
          .map((r) => `${displayName(r.source)} -> @vault:${r.vaultKey}`)
          .join('\n      ');
        return `  [${head.envName}] ${head.localKey} (values differ across apps):\n      ${sources}`;
      })
      .filter(Boolean)
      .join('\n');
    log.warn(
      `Vault keys were renamed to avoid cross-app collisions (your code keeps using the original names locally):\n${detail}`,
    );
  }

  if (plan.resolved.length === 0) {
    log.info(
      'All env files were empty or only contained framework-managed vars. Nothing to upload.',
    );
    outro('Done.');
    return { exitCode: 0 };
  }

  // 6. Per-vault-entry secret-or-literal checklist -------------------------
  // One row per unique (envName, vaultKey). Merged collisions collapse to a
  // single row; renamed collisions appear as separate rows (one per app).
  interface VaultGroup {
    composite: string; // `${envName}|${vaultKey}`
    envName: string;
    vaultKey: string;
    localKey: string;
    value: string;
    isAlias: boolean;
    verdict: ReturnType<typeof classifyEntry>['verdict'];
    label: string;
    hint: string;
    sources: ResolvedEntry[];
  }
  const groups = new Map<string, VaultGroup>();
  for (const r of plan.resolved) {
    const composite = `${r.envName}|${r.vaultKey}`;
    let g = groups.get(composite);
    if (!g) {
      const c = classifyEntry(r.localKey, r.value);
      const hint = c.hint || (r.isAlias ? 'looks like an alias literal' : 'no signal');
      // Alias literals are safe to show verbatim; everything else is
      // potentially a secret value and must be masked even in our own
      // TUI (AGENTS.md hard rule #1 applies to the user's terminal,
      // scrollback, and screen-share surfaces too).
      const preview = r.isAlias ? previewValue(r.value, 40) : maskedPreview(r.value, hint);
      const envTag = distinctEnvs.length > 1 ? `[${r.envName}] ` : '';
      const renamedTag = r.localKey !== r.vaultKey ? ` -> vault:${r.vaultKey}` : '';
      g = {
        composite,
        envName: r.envName,
        vaultKey: r.vaultKey,
        localKey: r.localKey,
        value: r.value,
        isAlias: r.isAlias,
        verdict: c.verdict,
        label: `${envTag}${r.localKey}${renamedTag}  ${preview}`,
        hint,
        sources: [],
      };
      groups.set(composite, g);
    }
    g.sources.push(r);
  }
  // Annotate labels with source dirs when there's more than one app feeding a group.
  for (const g of groups.values()) {
    const dirs = [...new Set(g.sources.map((s) => s.source.relativeDir || '<root>'))];
    if (dirs.length > 1) g.label = `${g.label}  (shared by ${dirs.join(', ')})`;
    else if (envFiles.some((f) => f.relativeDir !== '')) {
      const only = dirs[0];
      if (only && only !== '<root>') g.label = `${g.label}  [${only}]`;
    }
  }

  const choices = [...groups.values()];
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
      const envGroups = choices.filter((g) => g.envName === env);
      const sec = envGroups.filter((g) => selected.has(g.composite)).length;
      const lit = envGroups.length - sec;
      return `  ${env}: ${sec} secrets, ${lit} literals${env === defaultEnv ? ' (default — written to each app\'s .keynv.env)' : ''}`;
    })
    .join('\n');
  // Distinct containingDirs that will receive a .keynv.env file.
  const writeDirs = [...new Set(plan.resolved.map((r) => r.source.containingDir))];
  const writeDirsLines = writeDirs
    .map((d) => `  ${relFromRoot(root.path, d)}`)
    .join('\n');
  const renameLine =
    plan.renamed.length > 0
      ? `Renamed vault keys: ${plan.renamed.length} (to avoid cross-app collisions)`
      : '';
  const planSummary = [
    `Project:           ${projectChoice.name}${projectChoice.created ? ' (will be created)' : ''}`,
    `Environments:      ${distinctEnvs.join(', ')}`,
    'Per-env breakdown:',
    perEnvCounts,
    `Script wraps:      ${scriptWrapSelection.length}`,
    `.keynv.env files:  will be written under`,
    writeDirsLines,
    'Original .env files: rename to .env.backup after upload',
    renameLine,
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

  // 11. Upload secrets — one POST per unique (env, vaultKey). ---------------
  // Merged groups (multiple sources, same value, same vaultKey) upload once
  // and reuse the alias across every per-app .keynv.env that references them.
  const aliasByGroup = new Map<string, string>(); // composite -> aliasLiteral
  const failed: Array<{ env: string; name: string; reason: string }> = [];
  const groupsToUpload = choices.filter((g) => selected.has(g.composite));
  if (groupsToUpload.length > 0) {
    const s = spinner();
    s.start(
      `Uploading ${groupsToUpload.length} secret${groupsToUpload.length === 1 ? '' : 's'}`,
    );
    let i = 0;
    for (const g of groupsToUpload) {
      i++;
      s.message(`Uploading (${i}/${groupsToUpload.length}) [${g.envName}] ${g.vaultKey}`);
      try {
        await client.request(`/v1/projects/${projectId}/secrets`, {
          method: 'POST',
          body: { env: g.envName, key: g.vaultKey, value: g.value },
        });
        const alias = reference.buildAlias({
          project: projectChoice.name,
          environment: g.envName,
          key: g.vaultKey,
        });
        if (alias === null) {
          failed.push({
            env: g.envName,
            name: g.localKey,
            reason: `produced an invalid alias for project=${projectChoice.name} env=${g.envName} key=${g.vaultKey}`,
          });
        } else {
          aliasByGroup.set(g.composite, alias.literal);
        }
      } catch (err) {
        failed.push({
          env: g.envName,
          name: g.localKey,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (failed.length === 0) {
      s.stop(`Uploaded ${groupsToUpload.length} secret${groupsToUpload.length === 1 ? '' : 's'}`);
    } else {
      s.error(
        `${groupsToUpload.length - failed.length}/${groupsToUpload.length} uploaded; ${failed.length} failed`,
      );
      for (const f of failed) log.warn(`  [${f.env}] ${f.name}: ${f.reason}`);
    }
  }

  // 12. Compose per-(containingDir, env) .keynv.env files. ------------------
  // For each app directory that supplied .env files, write its own
  // .keynv.env (default env) and .keynv.<env>.env (other envs).
  interface DirEnvBucket {
    containingDir: string;
    envName: string;
    aliasLines: Array<[localKey: string, aliasLiteral: string]>;
    literalEntries: Array<{ name: string; value: string }>;
  }
  const bucketKey = (dir: string, env: string) => `${dir}|${env}`;
  const buckets = new Map<string, DirEnvBucket>();
  for (const r of plan.resolved) {
    const k = bucketKey(r.source.containingDir, r.envName);
    let b = buckets.get(k);
    if (!b) {
      b = {
        containingDir: r.source.containingDir,
        envName: r.envName,
        aliasLines: [],
        literalEntries: [],
      };
      buckets.set(k, b);
    }
    const groupKey = `${r.envName}|${r.vaultKey}`;
    const alias = aliasByGroup.get(groupKey);
    if (selected.has(groupKey) && alias !== undefined) {
      b.aliasLines.push([r.localKey, alias]);
    } else {
      b.literalEntries.push({ name: r.localKey, value: r.value });
    }
  }

  for (const b of buckets.values()) {
    const targetName = b.envName === defaultEnv ? '.keynv.env' : `.keynv.${b.envName}.env`;
    const targetPath = join(b.containingDir, targetName);
    const dirIntoExisting = existsSync(targetPath);
    try {
      const lines = composeKeynvEnv({
        uploadedAliases: new Map(b.aliasLines),
        literals: b.literalEntries.map((e) => ({ name: e.name, value: e.value })),
        mergeWithExisting: dirIntoExisting ? readFileSync(targetPath, 'utf8') : null,
      });
      writeFileSync(targetPath, `${lines.join('\n')}\n`);
      const relTarget = relFromRoot(root.path, targetPath);
      const total = b.aliasLines.length + b.literalEntries.length;
      log.success(
        `${dirIntoExisting ? 'Updated' : 'Wrote'} ${relTarget} (${total} entr${total === 1 ? 'y' : 'ies'} from "${b.envName}")`,
      );
    } catch (err) {
      log.error(
        `Failed to write ${relFromRoot(root.path, targetPath)}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { exitCode: 1 };
    }
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

  // 15. Rename the original .env files to .env.backup ----------------------
  for (const f of envFiles) {
    const relSrc = relFromRoot(root.path, f.path);
    try {
      const { renamedTo } = backupEnvFile(f.path);
      const relTarget = relFromRoot(root.path, renamedTo);
      log.success(`Renamed ${relSrc} -> ${relTarget}`);
    } catch (err) {
      log.warn(`Could not rename ${relSrc}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 16. Mention non-default envs and the files we wrote for them.
  const otherEnvs = distinctEnvs.filter((e) => e !== defaultEnv);
  if (otherEnvs.length > 0) {
    const lines = otherEnvs.map((env) => {
      const dirsForEnv = [
        ...new Set(
          [...buckets.values()].filter((b) => b.envName === env).map((b) => b.containingDir),
        ),
      ];
      if (dirsForEnv.length === 0) {
        return `  ${env}: 0 secrets in vault (no alias file written)`;
      }
      const fileList = dirsForEnv
        .map((d) => `${relFromRoot(root.path, d)}/.keynv.${env}.env`)
        .join(', ');
      return `  ${env}: ${fileList} (use \`keynv exec --from <file> -- <cmd>\`)`;
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
        message: `Map ${displayName(f)} to which keynv env?`,
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
 * Decide which env's aliases get written into each app's `.keynv.env`.
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

export interface ComposeOpts {
  uploadedAliases: Map<string, string>;
  literals: Array<{ name: string; value: string }>;
  mergeWithExisting: string | null;
}

export function composeKeynvEnv(opts: ComposeOpts): string[] {
  const { uploadedAliases, literals, mergeWithExisting } = opts;
  const lines: string[] = [];
  if (mergeWithExisting !== null) {
    const normalized = mergeWithExisting.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const trimmed = normalized.replace(/\n+$/, '');
    if (trimmed.length > 0) {
      lines.push(...trimmed.split('\n'));
      lines.push('');
    }
    lines.push(`# >>> keynv setup  ${new Date().toISOString().slice(0, 10)} >>>`);
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
    lines.push('# <<< keynv setup <<<');
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
