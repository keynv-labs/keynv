/**
 * Vault-key planner for multi-source env migration.
 *
 * In a monorepo where the same env-var name (`DATABASE_URL`,
 * `NEXT_PUBLIC_API_URL`, …) appears in several `.env` files mapped
 * to the same keynv environment, two cases must be distinguished:
 *
 *   1. **Same value**: all sources agree; one vault entry can back
 *      every per-dir `.keynv.env` reference. Use the bare key.
 *   2. **Different values**: each app legitimately needs its own
 *      secret; the local `process.env.<KEY>` must stay the same so
 *      application code keeps working, but the vault entries must
 *      not stomp each other. Prefix the vault key with a directory
 *      slug (parent basename; full path on secondary collision).
 *
 * Within a single containing directory, `.env`/`.env.local` style
 * overrides follow dotenv last-wins (which the caller has already
 * mapped to the same keynv env). That intra-dir collapse is also
 * handled here so the cross-dir collision check sees one entry per
 * (env, dir, key).
 */
import type { EnvFileHit } from './detect.js';

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export interface SourceEntry {
  file: EnvFileHit;
  envName: string;
  name: string;
  value: string;
  isAlias: boolean;
  /** 1-indexed line in the source file. */
  line: number;
}

export interface ResolvedEntry {
  envName: string;
  /** Original env-var name as it appears in the user's `.env`. */
  localKey: string;
  value: string;
  isAlias: boolean;
  /** Key used in the vault (may differ from localKey on collision). */
  vaultKey: string;
  source: EnvFileHit;
  line: number;
}

export interface MergeNote {
  envName: string;
  key: string;
  sources: EnvFileHit[];
}

export interface RenameNote {
  envName: string;
  localKey: string;
  vaultKey: string;
  source: EnvFileHit;
  /** Other sources in the same collision group, for explanatory logging. */
  otherSources: EnvFileHit[];
}

export interface IntraDirShadow {
  envName: string;
  localKey: string;
  containingDir: string;
  laterFile: string;
  earlierFiles: string[];
}

export interface CollisionPlan {
  resolved: ResolvedEntry[];
  renamed: RenameNote[];
  merged: MergeNote[];
  shadowed: IntraDirShadow[];
}

/**
 * Compute vault keys and rename/merge notes for all source entries.
 * Preserves source ordering of `sources` for stable output.
 */
export function planVaultKeys(sources: ReadonlyArray<SourceEntry>): CollisionPlan {
  // -- Step 1: intra-dir last-wins.
  // Group by (envName, containingDir, localKey); keep last-seen value.
  interface PerDirEntry {
    envName: string;
    containingDir: string;
    localKey: string;
    value: string;
    isAlias: boolean;
    source: EnvFileHit;
    line: number;
  }
  // Use Map of Map for deterministic iteration order.
  const byDir = new Map<string, Map<string, PerDirEntry>>(); // `${env}|${dir}` -> localKey -> entry
  const shadowedAccum = new Map<string, IntraDirShadow>(); // dedup key: env|dir|localKey

  for (const s of sources) {
    const dirKey = `${s.envName}|${s.file.containingDir}`;
    let perKey = byDir.get(dirKey);
    if (!perKey) {
      perKey = new Map<string, PerDirEntry>();
      byDir.set(dirKey, perKey);
    }
    const prior = perKey.get(s.name);
    if (prior) {
      const shadowKey = `${s.envName}|${s.file.containingDir}|${s.name}`;
      let note = shadowedAccum.get(shadowKey);
      if (!note) {
        note = {
          envName: s.envName,
          localKey: s.name,
          containingDir: s.file.containingDir,
          laterFile: s.file.name,
          earlierFiles: [prior.source.name],
        };
        shadowedAccum.set(shadowKey, note);
      } else {
        note.earlierFiles.push(note.laterFile);
        note.laterFile = s.file.name;
      }
    }
    perKey.set(s.name, {
      envName: s.envName,
      containingDir: s.file.containingDir,
      localKey: s.name,
      value: s.value,
      isAlias: s.isAlias,
      source: s.file,
      line: s.line,
    });
  }

  const intraResolved: PerDirEntry[] = [];
  for (const perKey of byDir.values()) intraResolved.push(...perKey.values());

  // -- Step 2: cross-dir collision groups.
  // Group by (envName, localKey).
  const groups = new Map<string, PerDirEntry[]>();
  for (const e of intraResolved) {
    const k = `${e.envName}|${e.localKey}`;
    let g = groups.get(k);
    if (!g) {
      g = [];
      groups.set(k, g);
    }
    g.push(e);
  }

  const resolved: ResolvedEntry[] = [];
  const renamed: RenameNote[] = [];
  const merged: MergeNote[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      const e = group[0] as PerDirEntry;
      resolved.push({
        envName: e.envName,
        localKey: e.localKey,
        value: e.value,
        isAlias: e.isAlias,
        vaultKey: toAliasKey(e.localKey),
        source: e.source,
        line: e.line,
      });
      continue;
    }

    const allSameValue = group.every((e) => e.value === group[0]?.value);
    if (allSameValue) {
      const vaultKey = toAliasKey((group[0] as PerDirEntry).localKey);
      merged.push({
        envName: (group[0] as PerDirEntry).envName,
        key: (group[0] as PerDirEntry).localKey,
        sources: group.map((e) => e.source),
      });
      for (const e of group) {
        resolved.push({
          envName: e.envName,
          localKey: e.localKey,
          value: e.value,
          isAlias: e.isAlias,
          vaultKey,
          source: e.source,
          line: e.line,
        });
      }
      continue;
    }

    // Different values: slug each source.
    // Try parent-basename slugs; escalate to full-path slugs if any clash.
    const initialSlugs = group.map((e) => initialSlug(e.source));
    const initialUnique = new Set(initialSlugs).size === initialSlugs.length;
    const slugs = initialUnique ? initialSlugs : group.map((e) => fullSlug(e.source));

    for (let i = 0; i < group.length; i++) {
      const e = group[i] as PerDirEntry;
      const slug = slugs[i] as string;
      const vaultKey = toAliasKey(`${slug}-${e.localKey}`);
      renamed.push({
        envName: e.envName,
        localKey: e.localKey,
        vaultKey,
        source: e.source,
        otherSources: group.filter((_, j) => j !== i).map((g) => g.source),
      });
      resolved.push({
        envName: e.envName,
        localKey: e.localKey,
        value: e.value,
        isAlias: e.isAlias,
        vaultKey,
        source: e.source,
        line: e.line,
      });
    }
  }

  // -- Step 3: normalized-key collision guard.
  // Groups above key on the EXACT localKey, but two DISTINCT local keys can
  // normalize to the same vaultKey (e.g. `foo!bar` and `foo@bar` → `foobar`,
  // or two >64-char names sharing a truncated prefix). Those land in different
  // groups and would silently overwrite each other in the vault (first-wins).
  // Detect on the normalized key and disambiguate with a counter (Y4).
  const takenByKey = new Map<string, ResolvedEntry>(); // `${env}|${vaultKey}` -> first entry
  for (const e of resolved) {
    const composite = `${e.envName}|${e.vaultKey}`;
    const prior = takenByKey.get(composite);
    if (!prior) {
      takenByKey.set(composite, e);
      continue;
    }
    // Same local key sharing a vault key is an intentional merge — not a clash.
    if (prior.localKey === e.localKey) continue;
    const disambiguated = firstFreeVaultKey(e.envName, e.vaultKey, takenByKey);
    renamed.push({
      envName: e.envName,
      localKey: e.localKey,
      vaultKey: disambiguated,
      source: e.source,
      otherSources: [prior.source],
    });
    e.vaultKey = disambiguated;
    takenByKey.set(`${e.envName}|${disambiguated}`, e);
  }

  return {
    resolved,
    renamed,
    merged,
    shadowed: [...shadowedAccum.values()],
  };
}

/**
 * First vault key of the form `<base>-2`, `<base>-3`, … not already taken in
 * `env`. The base is trimmed so the suffixed key never exceeds the 64-char
 * limit `KEY_RE` enforces.
 */
function firstFreeVaultKey(env: string, base: string, taken: Map<string, ResolvedEntry>): string {
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    if (!taken.has(`${env}|${candidate}`)) return candidate;
  }
}

/**
 * `apps/api` → `api`; root → `root`.
 */
function initialSlug(file: EnvFileHit): string {
  if (file.relativeDir === '') return 'root';
  const parts = file.relativeDir.split('/');
  return (parts[parts.length - 1] ?? 'root').toLowerCase();
}

/**
 * `apps/api` → `apps-api`; root → `root`.
 * Used as the secondary fallback when two distinct dirs share a
 * basename (e.g. `apps/api` and `services/api`).
 */
function fullSlug(file: EnvFileHit): string {
  if (file.relativeDir === '') return 'root';
  return file.relativeDir.toLowerCase().replace(/\//g, '-');
}

/**
 * Coerce an arbitrary string into a valid vault alias key.
 * Mirrors the helper used elsewhere in the CLI — kept local to avoid
 * cross-package abstraction churn.
 */
function toAliasKey(name: string): string {
  if (!name) return name;
  if (KEY_RE.test(name)) return name;
  const normalised = name.toLowerCase().replace(/_/g, '-');
  if (KEY_RE.test(normalised)) return normalised;
  return normalised.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'key';
}
