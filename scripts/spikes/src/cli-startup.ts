/**
 * Phase 0 spike: CLI cold-start latency.
 *
 * Measures how long a no-op `keynv --version` invocation takes, comparing
 * Bun (target runtime, single-binary compiled) against Node (fallback if
 * Bun is unavailable). Reports median + p95 over 25 runs.
 *
 * Target: Bun-compiled binary < 100 ms warm cache. Node baseline reported
 * for context only.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RUNS = 25;
const TARGET_WARM_MS = 100;
const HARD_FAIL_MS = 300;

interface RunResult {
  runtime: string;
  median: number;
  p95: number;
  raw: number[];
}

function pickStat(samples: number[], pct: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * pct));
  return sorted[idx] ?? 0;
}

function timeRun(cmd: string, args: string[]): number | null {
  const start = process.hrtime.bigint();
  const result = spawnSync(cmd, args, { stdio: 'ignore' });
  const end = process.hrtime.bigint();
  if (result.error || result.status !== 0) return null;
  return Number(end - start) / 1_000_000;
}

function which(cmd: string): string | null {
  const out = spawnSync('which', [cmd], { encoding: 'utf8' });
  if (out.status !== 0) return null;
  return out.stdout.trim() || null;
}

function run(label: string, cmd: string, args: string[]): RunResult {
  // Warm-up
  for (let i = 0; i < 3; i++) timeRun(cmd, args);
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = timeRun(cmd, args);
    if (t !== null) samples.push(t);
  }
  return {
    runtime: label,
    median: pickStat(samples, 0.5),
    p95: pickStat(samples, 0.95),
    raw: samples,
  };
}

function fmt(n: number) {
  return n.toFixed(1).padStart(7, ' ');
}

function main(): void {
  const tmp = join(tmpdir(), `keynv-spike-${process.pid}`);
  mkdirSync(tmp, { recursive: true });

  // Minimal version-print script.
  const scriptPath = join(tmp, 'noop.mjs');
  writeFileSync(scriptPath, `process.stdout.write('keynv 0.0.0-spike\\n');\n`);

  const results: RunResult[] = [];
  results.push(run('node      ', 'node', [scriptPath]));

  const bunPath = which('bun');
  if (bunPath) {
    results.push(run('bun (run) ', 'bun', ['run', scriptPath]));
  } else {
    console.log('  bun not on PATH — skipping Bun measurement.');
  }

  console.log('');
  console.log('CLI cold-start spike');
  console.log('─────────────────────────────────────────');
  console.log('runtime       median (ms)   p95 (ms)');
  for (const r of results) {
    console.log(`${r.runtime}  ${fmt(r.median)}     ${fmt(r.p95)}`);
  }
  console.log('─────────────────────────────────────────');

  const slowest = Math.max(...results.map((r) => r.median));
  const fastest = Math.min(...results.map((r) => r.median));
  if (existsSync(bunPath ?? '<none>') && bunPath) {
    const bun = results.find((r) => r.runtime.startsWith('bun'));
    if (bun && bun.median > HARD_FAIL_MS) {
      console.log(`HARD FAIL: bun median ${bun.median.toFixed(1)} ms > ${HARD_FAIL_MS} ms`);
      process.exit(1);
    }
    if (bun && bun.median > TARGET_WARM_MS) {
      console.log(
        `WARN: bun median ${bun.median.toFixed(1)} ms > target ${TARGET_WARM_MS} ms (acceptable for first release; revisit in Phase 5)`,
      );
    } else if (bun) {
      console.log(`OK: bun median ${bun.median.toFixed(1)} ms within target ${TARGET_WARM_MS} ms.`);
    }
  } else {
    console.log(
      `Bun unavailable. Node-only baseline median ${slowest.toFixed(1)} ms (informational).`,
    );
  }
  console.log(`Range across measured runtimes: ${fastest.toFixed(1)}–${slowest.toFixed(1)} ms`);

  rmSync(tmp, { recursive: true, force: true });
}

main();
