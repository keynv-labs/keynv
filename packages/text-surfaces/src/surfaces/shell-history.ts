import { constants, access } from 'node:fs/promises';
import { bashHistoryPath, fishHistoryPath, zshHistoryPath } from '../paths.js';
import { rewriteFile } from '../rewrite.js';
import { scanFile } from '../scan.js';
import type {
  RewriteOptions,
  RewriteResult,
  ScanOptions,
  TextSurface,
  TextSurfaceScanResult,
} from '../types.js';

type Shell = 'zsh' | 'bash' | 'fish';

function shellLabel(shell: Shell): string {
  switch (shell) {
    case 'zsh':
      return 'zsh history';
    case 'bash':
      return 'bash history';
    case 'fish':
      return 'fish history';
  }
}

function pathFor(shell: Shell): string {
  switch (shell) {
    case 'zsh':
      return zshHistoryPath();
    case 'bash':
      return bashHistoryPath();
    case 'fish':
      return fishHistoryPath();
  }
}

/**
 * fish_history uses YAML-ish records with backslash-escaped strings.
 * For scanning purposes we don't need to decode it — secrets that
 * landed there are still in plain text. We pass the raw bytes to the
 * redactor unchanged.
 *
 * zsh's HIST_EXTENDED_FORMAT prepends `: <ts>:<dur>;` to each line.
 * That prefix is harmless to the regex pattern bank.
 *
 * bash's optional HISTTIMEFORMAT inserts `#<ts>\n` comment lines. Also
 * harmless.
 *
 * So a single shared implementation suffices for Phase A scan.
 */
function createShellHistorySurface(shell: Shell): TextSurface {
  const filePath = pathFor(shell);

  return {
    id: `shell-history:${shell}`,
    label: shellLabel(shell),

    async isPresent(): Promise<boolean> {
      try {
        await access(filePath, constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },

    async enumerate(): Promise<ReadonlyArray<string>> {
      return [filePath];
    },

    async scan(options: ScanOptions = {}): Promise<TextSurfaceScanResult> {
      const fileScan = await scanFile(filePath, options);
      return {
        surfaceId: `shell-history:${shell}`,
        surfaceLabel: shellLabel(shell),
        files: [fileScan],
        totalMatches: fileScan.matchCount,
        totalBytes: fileScan.bytes,
      };
    },

    async rewrite(options: RewriteOptions = {}): Promise<RewriteResult> {
      const result = await rewriteFile(filePath, options);
      return {
        surfaceId: `shell-history:${shell}`,
        files: [result],
        totalMatchCount: result.matchCount,
      };
    },
  };
}

export function createZshHistorySurface(): TextSurface {
  return createShellHistorySurface('zsh');
}

export function createBashHistorySurface(): TextSurface {
  return createShellHistorySurface('bash');
}

export function createFishHistorySurface(): TextSurface {
  return createShellHistorySurface('fish');
}
