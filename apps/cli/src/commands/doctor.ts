import { homedir } from 'node:os';
import { relative } from 'node:path';
import {
  type ScanOptions,
  type TextSurface,
  type TextSurfaceScanResult,
  builtinSurfaces,
} from '@keynv/text-surfaces';
import { Command, Option } from 'clipanion';
import { handleExecError } from '../ui/format.js';

/**
 * `keynv doctor` — read-only retro-scan of the developer's text
 * surfaces (shell histories, Claude Code transcripts, Cursor logs).
 * Reports likely-secret counts and pattern-class previews. Never echoes
 * raw matched values.
 *
 * Exit codes:
 *   0  — no likely leaks
 *   1  — at least one leak was found (CI-friendly)
 *   2  — internal error
 */
export class DoctorCommand extends Command {
  static override paths = [['doctor']];
  static override usage = Command.Usage({
    description: 'Scan local text surfaces for leaked secret values (heuristic, read-only).',
    details: `
Walks shell history files, Claude Code transcripts, and Cursor logs,
counting strings that look like secrets. Nothing is rewritten — see
\`keynv scrub\` for that. Nothing is sent over the network. Match
previews are bounded to 3 chars; raw values are never printed.

Heuristic: the redactor's pattern bank (AWS, GCP, GitHub, Stripe,
JWT, PEM, DB URIs, …) plus a Shannon-entropy detector for high-entropy
opaque tokens. False positives are possible — pass --no-entropy to
suppress entropy hits.
`,
    examples: [
      ['Scan everything present', '$0 doctor'],
      ['Limit to a single surface', '$0 doctor --surface shell-history:zsh'],
      ['Disable the entropy detector', '$0 doctor --no-entropy'],
      ['JSON output (for CI / piping)', '$0 doctor --json'],
    ],
  });

  json = Option.Boolean('--json', false);
  noEntropy = Option.Boolean('--no-entropy', false);
  quiet = Option.Boolean('--quiet,-q', false);
  surfaceFilter = Option.Array('--surface');
  maxFiles = Option.String('--max-files');

  async execute(): Promise<number> {
    try {
      const allSurfaces = builtinSurfaces();
      const requested = this.surfaceFilter ?? [];
      const surfaces: TextSurface[] = [];
      for (const s of allSurfaces) {
        if (requested.length > 0 && !requested.includes(s.id)) continue;
        if (await s.isPresent()) surfaces.push(s);
      }

      if (surfaces.length === 0) {
        if (this.json) {
          this.context.stdout.write(`${JSON.stringify({ surfaces: [], totalMatches: 0 })}\n`);
          return 0;
        }
        this.context.stdout.write(
          'keynv doctor: no known text surfaces are present on this machine.\n',
        );
        return 0;
      }

      let maxFilesPerSurface: number | undefined;
      if (this.maxFiles) {
        const n = Number.parseInt(this.maxFiles, 10);
        if (!Number.isFinite(n) || n <= 0) {
          this.context.stderr.write('keynv: --max-files must be a positive integer\n');
          return 2;
        }
        maxFilesPerSurface = n;
      }
      const scanOptions: ScanOptions = {
        ...(this.noEntropy ? { entropy: false } : {}),
        ...(maxFilesPerSurface !== undefined ? { maxFilesPerSurface } : {}),
      };

      const results: TextSurfaceScanResult[] = [];
      for (const s of surfaces) {
        results.push(await s.scan(scanOptions));
      }

      const totalMatches = results.reduce((acc, r) => acc + r.totalMatches, 0);

      if (this.json) {
        this.context.stdout.write(
          `${JSON.stringify({ surfaces: results, totalMatches }, null, 2)}\n`,
        );
        return totalMatches > 0 ? 1 : 0;
      }

      this.renderHuman(results, totalMatches);
      return totalMatches > 0 ? 1 : 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }

  private renderHuman(results: ReadonlyArray<TextSurfaceScanResult>, totalMatches: number): void {
    const out = this.context.stdout;
    const home = homedir();
    const tilde = (p: string): string => {
      if (p === home) return '~';
      if (p.startsWith(`${home}/`)) return `~/${relative(home, p)}`;
      return p;
    };

    if (!this.quiet) {
      out.write('keynv doctor — scanning text surfaces…\n\n');
    }

    const patternCounts = new Map<string, number>();
    const samplePreviews: Array<{ pattern: string; preview: string; path: string }> = [];
    const seenPatternsInPreviews = new Set<string>();

    for (const r of results) {
      const filesWithMatches = r.files.filter((f) => f.matchCount > 0);
      const skipped = r.files.filter((f) => f.skipped);
      const symbol = r.totalMatches > 0 ? '!' : '·';
      const summary =
        r.totalMatches > 0
          ? `${r.totalMatches} likely secret${r.totalMatches === 1 ? '' : 's'} across ${filesWithMatches.length} file${filesWithMatches.length === 1 ? '' : 's'}`
          : 'clean';
      out.write(`  ${symbol}  ${r.surfaceLabel.padEnd(26)}  ${summary}\n`);

      for (const f of r.files) {
        // Aggregate true per-pattern counts (not just previews).
        for (const [name, count] of Object.entries(f.patternCounts)) {
          patternCounts.set(name, (patternCounts.get(name) ?? 0) + count);
        }
        // Sample previews: prefer pattern diversity so the user sees a
        // representative cross-section rather than 10 entropy hits from
        // the first noisy file.
        for (const p of f.previews) {
          if (samplePreviews.length >= 10) break;
          const key = `${p.pattern}:${f.path}`;
          if (seenPatternsInPreviews.has(key)) continue;
          seenPatternsInPreviews.add(key);
          samplePreviews.push({ pattern: p.pattern, preview: p.preview, path: tilde(f.path) });
        }
      }

      if (!this.quiet && skipped.length > 0) {
        const first = skipped[0];
        if (first) {
          out.write(
            `         (skipped ${skipped.length}: e.g., ${tilde(first.path)} — ${first.skipReason ?? 'unknown'})\n`,
          );
        }
      }
    }

    out.write('\n');
    if (totalMatches === 0) {
      out.write(
        '  No likely leaks found. (Heuristic scan — see docs/03-text-surfaces.md for limitations.)\n',
      );
      return;
    }

    out.write(
      `  Total: ${totalMatches} likely secret${totalMatches === 1 ? '' : 's'} across ${results.reduce((n, r) => n + r.files.filter((f) => f.matchCount > 0).length, 0)} file(s).\n\n`,
    );

    const topPatterns = [...patternCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (topPatterns.length > 0) {
      out.write('  Top patterns:\n');
      const widest = Math.max(...topPatterns.map(([n]) => n.length));
      for (const [name, count] of topPatterns) {
        out.write(`    ${name.padEnd(widest)}  ${count}\n`);
      }
      out.write('\n');
    }

    if (samplePreviews.length > 0 && !this.quiet) {
      out.write('  Sample previews (truncated; raw values never shown):\n');
      for (const s of samplePreviews) {
        out.write(`    [${s.pattern}] ${s.preview}  in ${s.path}\n`);
      }
      out.write('\n');
    }

    out.write('  Next:\n');
    out.write('    keynv scrub                 # atomic retro-rewrite (with backups)\n');
    out.write('    keynv shell install         # stop new leaks landing in shell history\n');
    out.write('    keynv watch start           # scrub live AI-agent sessions in real time\n');
  }
}
