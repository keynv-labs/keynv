import { homedir } from 'node:os';
import { relative } from 'node:path';
import { confirm, isCancel } from '@clack/prompts';
import {
  type RewriteOptions,
  type RewriteResult,
  type ScanOptions,
  type TextSurface,
  builtinSurfaces,
} from '@keynv/text-surfaces';
import { Command, Option } from 'clipanion';
import { handleExecError } from '../ui/format.js';
import { isInteractive } from '../ui/helpers/tty.js';

/**
 * `keynv scrub` — atomic retro-rewrite of leaked secrets across the
 * developer's text surfaces. The companion to `keynv doctor`: doctor
 * finds, scrub fixes. Backups are written by default; the operation
 * is idempotent (running on already-clean files is a no-op).
 *
 * Safety:
 *   - Files mtime'd in the last 10s are skipped unless --include-active.
 *   - Default replacement is per-pattern (`<REDACTED:aws-access-key-id>`)
 *     for diagnostic value; override with --replacement.
 *   - Backups land at `<path>.keynv.bak.<ts>` next to the original.
 *
 * Exit codes:
 *   0  — successful run (with or without rewrites)
 *   1  — partial: at least one file was skipped due to a non-success reason
 *         (active-write, read-failed, write-failed)
 *   2  — internal error / bad args
 *   130 — cancelled at the prompt
 */
export class ScrubCommand extends Command {
  static override paths = [['scrub']];
  static override usage = Command.Usage({
    description: 'Atomically rewrite leaked secrets across local text surfaces (with backups).',
    details: `
Reads each text surface (shell histories, Claude Code transcripts,
Cursor logs), runs the redactor, and rewrites the file in place if
matches were found. Backups are written first; the rename is atomic
on the same filesystem.

By default, files touched in the last 10 seconds are *skipped* — they
may be actively being written by another process (e.g., a live Claude
Code session), and overwriting them could lose in-flight appends.
Pass --include-active to override.

--json is an output format, not a consent flag: \`scrub --json\` without
--yes emits the plan as JSON and writes nothing. Add --yes to actually
rewrite.
`,
    examples: [
      ['Scrub everything (interactive confirm)', '$0 scrub'],
      ['Non-interactive (e.g., in CI / scripts)', '$0 scrub --yes'],
      ['Preview the plan without mutating', '$0 scrub --dry-run'],
      ['Only the zsh history', '$0 scrub --surface shell-history:zsh --yes'],
      ['Custom replacement token', '$0 scrub --replacement "[REDACTED:keynv]" --yes'],
    ],
  });

  json = Option.Boolean('--json', false);
  yes = Option.Boolean('--yes,-y', false);
  dryRun = Option.Boolean('--dry-run', false);
  noBackup = Option.Boolean('--no-backup', false);
  noEntropy = Option.Boolean('--no-entropy', false);
  includeActive = Option.Boolean('--include-active', false);
  surfaceFilter = Option.Array('--surface');
  maxFiles = Option.String('--max-files');
  replacement = Option.String('--replacement');

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
          this.context.stdout.write(`${JSON.stringify({ surfaces: [], totalMatchCount: 0 })}\n`);
          return 0;
        }
        this.context.stdout.write(
          'keynv scrub: no known text surfaces are present on this machine.\n',
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
        ...(this.noEntropy ? { entropy: false as const } : {}),
        ...(maxFilesPerSurface !== undefined ? { maxFilesPerSurface } : {}),
      };

      // Phase 1: scan to compute the plan + show the user what's about
      // to happen. We deliberately re-scan rather than trusting a
      // doctor result the user might have run hours ago.
      const scanResults = await Promise.all(surfaces.map((s) => s.scan(scanOptions)));
      const totalToFix = scanResults.reduce((acc, r) => acc + r.totalMatches, 0);

      if (totalToFix === 0) {
        if (this.json) {
          this.context.stdout.write(`${JSON.stringify({ totalMatchCount: 0, surfaces: [] })}\n`);
          return 0;
        }
        this.context.stdout.write('keynv scrub: nothing to do — no likely secrets found.\n');
        return 0;
      }

      if (!this.json && !this.dryRun) {
        this.printScanPlan(scanResults, totalToFix);
      }

      // Confirmation gate. --yes / --dry-run / --json bypass.
      if (!this.yes && !this.dryRun && !this.json) {
        if (!isInteractive()) {
          this.context.stderr.write(
            'keynv scrub: refusing to mutate files non-interactively. Pass --yes (act) or --dry-run (preview).\n',
          );
          return 2;
        }
        const proceed = await confirm({
          message: `Rewrite ${totalToFix} match${totalToFix === 1 ? '' : 'es'} across ${surfaces.length} surface${surfaces.length === 1 ? '' : 's'}? (Backups will be written next to each file.)`,
          initialValue: false,
        });
        if (isCancel(proceed) || !proceed) {
          this.context.stdout.write('cancelled.\n');
          return 130;
        }
      }

      // `--json` is an OUTPUT FORMAT, not a consent signal. A `--json` run
      // without `--yes` is treated as a plan: the scan result is emitted as
      // JSON and NO files are written. Scripts must opt in explicitly with
      // `--yes` to actually mutate (this also means `--json --no-backup`
      // can never irreversibly rewrite without `--yes`).
      const effectiveDryRun = this.dryRun || (this.json && !this.yes);

      const rewriteOptions: RewriteOptions = {
        ...(this.noBackup ? { backup: false } : {}),
        ...(effectiveDryRun ? { dryRun: true } : {}),
        ...(this.includeActive ? { includeActive: true } : {}),
        ...(this.replacement !== undefined ? { replacement: this.replacement } : {}),
        scanOptions,
      };

      const rewriteResults: RewriteResult[] = [];
      for (const s of surfaces) {
        rewriteResults.push(await s.rewrite(rewriteOptions));
      }

      const totalMatchCount = rewriteResults.reduce((acc, r) => acc + r.totalMatchCount, 0);
      const skippedDueToActive = rewriteResults
        .flatMap((r) => r.files)
        .filter((f) => f.skipReason?.startsWith('actively-written'));
      const skippedDueToError = rewriteResults
        .flatMap((r) => r.files)
        .filter((f) => f.skipped && !f.skipReason?.startsWith('actively-written'));

      if (this.json) {
        this.context.stdout.write(
          `${JSON.stringify(
            {
              dryRun: effectiveDryRun,
              totalMatchCount,
              surfaces: rewriteResults,
            },
            null,
            2,
          )}\n`,
        );
        return skippedDueToError.length > 0 ? 1 : 0;
      }

      this.printRewriteResults(rewriteResults, totalMatchCount, skippedDueToActive.length);

      return skippedDueToError.length > 0 ? 1 : 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }

  private printScanPlan(
    results: ReadonlyArray<{
      readonly surfaceLabel: string;
      readonly totalMatches: number;
      readonly files: ReadonlyArray<{ readonly path: string; readonly matchCount: number }>;
    }>,
    totalToFix: number,
  ): void {
    const out = this.context.stdout;
    out.write(
      `keynv scrub — plan: ${totalToFix} likely secret${totalToFix === 1 ? '' : 's'} to rewrite\n\n`,
    );
    for (const r of results) {
      if (r.totalMatches === 0) continue;
      const filesWithMatches = r.files.filter((f) => f.matchCount > 0);
      out.write(
        `  ${r.surfaceLabel.padEnd(26)}  ${r.totalMatches} match${r.totalMatches === 1 ? '' : 'es'} in ${filesWithMatches.length} file${filesWithMatches.length === 1 ? '' : 's'}\n`,
      );
    }
    out.write('\n');
  }

  private printRewriteResults(
    results: ReadonlyArray<RewriteResult>,
    totalMatchCount: number,
    activeSkipped: number,
  ): void {
    const out = this.context.stdout;
    const home = homedir();
    const tilde = (p: string): string =>
      p === home ? '~' : p.startsWith(`${home}/`) ? `~/${relative(home, p)}` : p;

    if (this.dryRun) {
      out.write(
        `(dry-run) would rewrite ${totalMatchCount} match${totalMatchCount === 1 ? '' : 'es'}\n\n`,
      );
    } else {
      out.write(
        `done. ${totalMatchCount} match${totalMatchCount === 1 ? '' : 'es'} rewritten.\n\n`,
      );
    }

    for (const r of results) {
      const interesting = r.files.filter((f) => f.matchCount > 0 || f.skipped);
      if (interesting.length === 0) continue;
      out.write(`  ${r.surfaceId}\n`);
      for (const f of interesting) {
        if (f.skipped) {
          out.write(`    -  ${tilde(f.path)}\n         skipped: ${f.skipReason ?? 'unknown'}\n`);
          continue;
        }
        const tail = f.backupPath ? ` (backup: ${tilde(f.backupPath)})` : '';
        const verb = this.dryRun ? 'would rewrite' : 'rewrote';
        out.write(
          `    ${verb === 'rewrote' ? '+' : '?'}  ${tilde(f.path)}\n         ${f.matchCount} match${f.matchCount === 1 ? '' : 'es'}${tail}\n`,
        );
      }
    }

    if (activeSkipped > 0) {
      out.write(
        `\n  Note: ${activeSkipped} file${activeSkipped === 1 ? '' : 's'} skipped (actively being written).\n        Pass --include-active to rewrite anyway; in-flight appends may be lost.\n`,
      );
    }

    if (!this.dryRun) {
      out.write('\n  Verify with `keynv doctor` (should report fewer or zero matches).\n');
    }
  }
}
