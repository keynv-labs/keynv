import { reference } from '@keynv/core';
import type { ApiClient } from '../client/http.js';
import type { ProjectListItem } from '../commands/project.js';

export interface ResolvedAlias {
  alias: reference.Alias;
  value: string;
}

/**
 * Resolves every distinct alias found in `argv` and `extraStrings` to
 * its plaintext value. Caches both the project-id-by-name lookup and
 * each alias's value within the call so duplicate aliases do a single
 * server round-trip.
 *
 * Throws on the first unresolved alias (unknown project, missing
 * secret, RBAC denial). The privileged-subprocess wrapper aborts
 * before forking when this happens — no partial substitution.
 */
export async function resolveAllAliases(
  client: ApiClient,
  argv: readonly string[],
  extraStrings: readonly string[] = [],
): Promise<ResolvedAlias[]> {
  // Collect unique aliases from argv and any extra strings (e.g.,
  // --via-env values).
  const seen = new Map<string, reference.Alias>();
  const argvScans = reference.findAliasesInArgv(argv);
  for (const { matches } of argvScans) {
    for (const m of matches) {
      seen.set(m.literal, m);
    }
  }
  for (const s of extraStrings) {
    for (const m of reference.findAliasesInArgv([s])) {
      for (const x of m.matches) seen.set(x.literal, x);
    }
  }

  if (seen.size === 0) return [];

  // Build project name → id map (one server call regardless of alias count).
  const projectsList = await client.request<{ projects: ProjectListItem[] }>('/v1/projects');
  const projectIds = new Map<string, string>();
  for (const p of projectsList.projects) projectIds.set(p.name, p.id);

  const resolved: ResolvedAlias[] = [];
  for (const alias of seen.values()) {
    const projectId = projectIds.get(alias.project);
    if (!projectId) {
      throw new Error(`unknown project '${alias.project}' for alias ${alias.literal}`);
    }
    const data = await client.request<{ value: string }>(
      `/v1/projects/${projectId}/secrets/${alias.environment}/${alias.key}`,
    );
    resolved.push({ alias, value: data.value });
  }
  return resolved;
}

/**
 * Replaces every alias literal in `text` with the resolver's value.
 * Used both for argv substitution and for `--via-env` value rewrites.
 */
export function substitute(text: string, resolved: ReadonlyArray<ResolvedAlias>): string {
  // Process longer literals first to prevent partial prefix substitution.
  const sorted = [...resolved].sort((a, b) => b.alias.literal.length - a.alias.literal.length);
  let out = text;
  for (const r of sorted) {
    out = out.split(r.alias.literal).join(r.value);
  }
  return out;
}
