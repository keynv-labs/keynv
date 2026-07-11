/**
 * package.json script analysis + idempotent wrapping for `keynv init`.
 *
 * Looks at each script command, decides whether the underlying tool
 * is likely to read env vars at runtime (next, vite, node, vitest…),
 * and produces a "wrap with `keynv exec --`" suggestion the user
 * can accept or skip per-script in the init checklist.
 */

const KEYNV_PREFIX = 'keynv exec --';

/**
 * Tools whose value comes mainly from `process.env` — wrapping them
 * with `keynv exec` is the entire point of `.keynv.env`.
 *
 * The match is on the *first command word* in a script. Anything
 * not in this list is left alone (you don't want to wrap `eslint .`
 * or `tsc --noEmit`).
 */
const ENV_AWARE_TOOLS = new Set([
  'node',
  'tsx',
  'ts-node',
  'bun',
  'deno',
  'next',
  'nuxt',
  'vite',
  'remix',
  'astro',
  'gatsby',
  'nest',
  'webpack',
  'rollup',
  'parcel',
  'vitest',
  'jest',
  'mocha',
  'cypress',
  'playwright',
  'storybook',
  'tsc-watch',
  'pm2',
  'forever',
  'nodemon',
  'concurrently',
  // Monorepo / task runners — wrapping the orchestrator injects secrets into
  // every child task it spawns, so `npm run dev` still needs no `keynv exec`.
  'turbo',
  'nx',
  'lerna',
  'make',
  'npm-run-all',
  'run-p',
  'run-s',
  'pytest',
  'python',
  'python3',
  'gunicorn',
  'uvicorn',
  'celery',
  'flask',
  'django-admin',
  'manage.py',
  'rails',
  'rake',
  'go',
  'cargo',
  'air',
]);

/**
 * Tools we're confident DO NOT need env-injection. Listed only so
 * the suggestion message can show "skipped — no env needed" instead
 * of staying silent.
 */
const NON_ENV_TOOLS = new Set([
  'eslint',
  'biome',
  'prettier',
  'tsc',
  'tslint',
  'stylelint',
  'rm',
  'cp',
  'mv',
  'mkdir',
  'echo',
  'cat',
  'find',
  'grep',
  'sort',
  'uniq',
  'sed',
  'awk',
]);

export type WrapVerdict = 'wrap' | 'skip-already-wrapped' | 'skip-no-env-tool' | 'skip-unknown';

export interface ScriptAnalysis {
  name: string;
  original: string;
  wrapped: string;
  verdict: WrapVerdict;
  hint: string;
}

/**
 * Inspect a single script command and decide how to handle it.
 *
 * - `wrap`: prepend `keynv exec --` (default-checked in UI)
 * - `skip-already-wrapped`: command already starts with `keynv exec`
 *   or `keynv` — leave it alone, never double-wrap
 * - `skip-no-env-tool`: linters / formatters / shell utilities that
 *   don't read env vars (default-unchecked, easy for user to flip)
 * - `skip-unknown`: tool isn't in either list (default-unchecked,
 *   user decides — show the original command as the hint)
 */
export function analyzeScript(name: string, command: string): ScriptAnalysis {
  const trimmed = command.trim();
  if (trimmed.startsWith('keynv ') || trimmed.startsWith('keynv\t')) {
    return {
      name,
      original: command,
      wrapped: command,
      verdict: 'skip-already-wrapped',
      hint: 'already wrapped',
    };
  }
  const firstWord = extractFirstCommandWord(trimmed);
  if (firstWord === null) {
    return {
      name,
      original: command,
      wrapped: `${KEYNV_PREFIX} ${command}`,
      verdict: 'skip-unknown',
      hint: 'cannot parse',
    };
  }

  const wrapped = `${KEYNV_PREFIX} ${command}`;
  if (ENV_AWARE_TOOLS.has(firstWord)) {
    return { name, original: command, wrapped, verdict: 'wrap', hint: `${firstWord} reads env` };
  }
  if (NON_ENV_TOOLS.has(firstWord)) {
    return {
      name,
      original: command,
      wrapped,
      verdict: 'skip-no-env-tool',
      hint: `${firstWord} doesn't need env`,
    };
  }
  return {
    name,
    original: command,
    wrapped,
    verdict: 'skip-unknown',
    hint: `unrecognized: ${firstWord}`,
  };
}

/**
 * Pull the first command word out of a script string. Handles common
 * shell prefixes:
 *
 *   FOO=bar baz qux   → 'baz'
 *   cross-env X=y next dev → 'next'
 *   NODE_ENV=production next start → 'next'
 *   sh -c 'next dev' → null (we can't reliably introspect sh -c)
 */
export function extractFirstCommandWord(s: string): string | null {
  const tokens = s.split(/\s+/).filter((t) => t.length > 0);
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i] as string;
    // env-var assignment prefix (FOO=bar)
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
      i++;
      continue;
    }
    // cross-env wrapper — skip it AND its KEY=VALUE assignments
    if (t === 'cross-env') {
      i++;
      while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i] as string)) i++;
      continue;
    }
    // dotenv-cli wrapper — fast-forward past its flags to the
    // command after the `--` separator. dotenv flags can take values
    // as separate args (`-e .env`) so flag-by-flag skipping is brittle;
    // looking for `--` is the reliable form.
    if (t === 'dotenv') {
      const dashDash = tokens.indexOf('--', i + 1);
      if (dashDash >= 0) {
        i = dashDash + 1;
        continue;
      }
      // No `--` — give up; treat the next non-flag, non-assignment
      // token as the tool.
      i++;
      while (i < tokens.length && (tokens[i] as string).startsWith('-')) i++;
      continue;
    }
    if (t === 'sh' || t === 'bash' || t === 'zsh') {
      // shell-quoted scripts are too varied to introspect — bail out
      return null;
    }
    // strip a leading `./` or path so the basename is the tool name
    return t.replace(/^.*\//, '');
  }
  return null;
}

export interface WrapPlan {
  /** Scripts the init UI should default to checked. */
  recommended: ScriptAnalysis[];
  /** Already-wrapped or non-env scripts — surfaced for transparency. */
  skipped: ScriptAnalysis[];
  /** Unrecognized first-word — user can opt in. */
  unknown: ScriptAnalysis[];
}

export function planScriptWrap(scripts: Record<string, string>): WrapPlan {
  const recommended: ScriptAnalysis[] = [];
  const skipped: ScriptAnalysis[] = [];
  const unknown: ScriptAnalysis[] = [];
  for (const [name, command] of Object.entries(scripts)) {
    const analysis = analyzeScript(name, command);
    switch (analysis.verdict) {
      case 'wrap':
        recommended.push(analysis);
        break;
      case 'skip-unknown':
        unknown.push(analysis);
        break;
      default:
        skipped.push(analysis);
    }
  }
  return { recommended, skipped, unknown };
}

/**
 * Apply the user's chosen wraps to a parsed package.json scripts
 * object, returning a new object. Pure function — caller persists.
 *
 * Idempotent: if a script is already wrapped, it stays unchanged
 * even if the user mistakenly checked it.
 */
export function applyWraps(
  original: Record<string, string>,
  selectedScriptNames: ReadonlyArray<string>,
): Record<string, string> {
  const out: Record<string, string> = { ...original };
  const selection = new Set(selectedScriptNames);
  for (const [name, command] of Object.entries(original)) {
    if (!selection.has(name)) continue;
    const trimmed = command.trim();
    if (trimmed.startsWith('keynv ') || trimmed.startsWith('keynv\t')) continue;
    out[name] = `${KEYNV_PREFIX} ${command}`;
  }
  return out;
}
