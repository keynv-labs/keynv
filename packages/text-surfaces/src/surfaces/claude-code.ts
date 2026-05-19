import { constants, access, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { claudeCodeProjectsDir } from '../paths.js';
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
 * Claude Code stores per-project session transcripts as JSONL under
 *   ~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
 *
 * For scanning, we treat the raw JSONL as one big string. The
 * line-by-line JSON structure does not interfere with regex/entropy
 * detection — secrets that land in user/assistant message bodies will
 * be matched. The structured per-field rewrite is a Phase A Step 2
 * concern; scan only counts.
 */
export function createClaudeCodeSurface(): TextSurface {
  const root = claudeCodeProjectsDir();

  async function listJsonl(): Promise<string[]> {
    try {
      await access(root, constants.R_OK);
    } catch {
      return [];
    }
    const out: string[] = [];
    let projectDirs: string[] = [];
    try {
      projectDirs = await readdir(root);
    } catch {
      return [];
    }
    for (const proj of projectDirs) {
      const projPath = join(root, proj);
      let st: Awaited<ReturnType<typeof stat>>;
      try {
        st = await stat(projPath);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      let entries: string[] = [];
      try {
        entries = await readdir(projPath);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.endsWith('.jsonl')) out.push(join(projPath, entry));
      }
    }
    return out;
  }

  return {
    id: 'claude-code:transcripts',
    label: 'Claude Code transcripts',

    async isPresent(): Promise<boolean> {
      try {
        await access(root, constants.R_OK);
        return true;
      } catch {
        return false;
      }
    },

    async enumerate(): Promise<ReadonlyArray<string>> {
      return listJsonl();
    },

    async scan(options: ScanOptions = {}): Promise<TextSurfaceScanResult> {
      const limit = options.maxFilesPerSurface ?? SCAN_DEFAULTS.maxFilesPerSurface;
      const files = (await listJsonl()).slice(0, limit);

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
        surfaceId: 'claude-code:transcripts',
        surfaceLabel: 'Claude Code transcripts',
        files: fileScans,
        totalMatches,
        totalBytes,
      };
    },

    async rewrite(options: RewriteOptions = {}): Promise<RewriteResult> {
      const files = await listJsonl();
      const results: RewriteFileResult[] = [];
      let totalMatchCount = 0;
      for (const f of files) {
        const r = await rewriteFile(f, options);
        results.push(r);
        totalMatchCount += r.matchCount;
      }
      return {
        surfaceId: 'claude-code:transcripts',
        files: results,
        totalMatchCount,
      };
    },
  };
}
