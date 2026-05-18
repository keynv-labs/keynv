import { constants, access, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { cursorLogsDir } from '../paths.js';
import { rewriteFile } from '../rewrite.js';
import { SCAN_DEFAULTS, scanFile } from '../scan.js';
import type {
  RewriteFileResult,
  RewriteOptions,
  RewriteResult,
  ScanOptions,
  TextSurface,
  TextSurfaceFileScan,
  TextSurfaceScanResult,
} from '../types.js';

/**
 * Cursor's log directory contains per-session subfolders with `.log`
 * files. We walk one level deep and scan every `.log` we find. Deeper
 * Cursor-internal nesting is uncommon; if it ever changes, the
 * generic-log surface can be configured by the user as a fallback.
 */
export function createCursorSurface(): TextSurface {
  const root = cursorLogsDir();

  async function listLogs(): Promise<string[]> {
    try {
      await access(root, constants.R_OK);
    } catch {
      return [];
    }
    const out: string[] = [];
    let topLevel: string[] = [];
    try {
      topLevel = await readdir(root);
    } catch {
      return [];
    }
    for (const entry of topLevel) {
      const entryPath = join(root, entry);
      let st: Awaited<ReturnType<typeof stat>>;
      try {
        st = await stat(entryPath);
      } catch {
        continue;
      }
      if (st.isFile() && entry.endsWith('.log')) {
        out.push(entryPath);
        continue;
      }
      if (!st.isDirectory()) continue;
      let inner: string[] = [];
      try {
        inner = await readdir(entryPath);
      } catch {
        continue;
      }
      for (const f of inner) {
        if (f.endsWith('.log')) out.push(join(entryPath, f));
      }
    }
    return out;
  }

  return {
    id: 'cursor:logs',
    label: 'Cursor logs',

    async isPresent(): Promise<boolean> {
      try {
        await access(root, constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },

    async enumerate(): Promise<ReadonlyArray<string>> {
      return listLogs();
    },

    async scan(options: ScanOptions = {}): Promise<TextSurfaceScanResult> {
      const limit = options.maxFilesPerSurface ?? SCAN_DEFAULTS.maxFilesPerSurface;
      const files = (await listLogs()).slice(0, limit);
      const fileScans: TextSurfaceFileScan[] = [];
      let totalMatches = 0;
      let totalBytes = 0;
      for (const file of files) {
        const scan = await scanFile(file, options);
        fileScans.push(scan);
        totalMatches += scan.matchCount;
        totalBytes += scan.bytes;
      }
      return {
        surfaceId: 'cursor:logs',
        surfaceLabel: 'Cursor logs',
        files: fileScans,
        totalMatches,
        totalBytes,
      };
    },

    async rewrite(options: RewriteOptions = {}): Promise<RewriteResult> {
      const files = await listLogs();
      const results: RewriteFileResult[] = [];
      let totalMatchCount = 0;
      for (const f of files) {
        const r = await rewriteFile(f, options);
        results.push(r);
        totalMatchCount += r.matchCount;
      }
      return {
        surfaceId: 'cursor:logs',
        files: results,
        totalMatchCount,
      };
    },
  };
}
