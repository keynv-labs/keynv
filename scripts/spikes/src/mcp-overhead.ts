/**
 * Phase 0 spike: MCP stdio round-trip latency.
 *
 * Spawns a tiny child-process server that speaks MCP-flavored JSON-RPC
 * (line-delimited, like the real MCP stdio transport) and measures the
 * round-trip latency for 1000 no-op `who_am_i`-style requests.
 *
 * Target: < 20 ms round-trip locally. Hard fail above 50 ms.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REQUESTS = 1000;
const TARGET_MS = 20;
const HARD_FAIL_MS = 50;

const SERVER_SOURCE = `
// Tiny stdio JSON-RPC echo server.
let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  let idx;
  while ((idx = buf.indexOf('\\n')) !== -1) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      const req = JSON.parse(line);
      const res = {
        jsonrpc: '2.0',
        id: req.id,
        result: { user_id: 'u_stub', email: 'spike@local', org_role: 'developer' },
      };
      process.stdout.write(JSON.stringify(res) + '\\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'parse' } }) + '\\n');
    }
  }
});
`;

function pickStat(samples: number[], pct: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * pct));
  return sorted[idx] ?? 0;
}

async function main(): Promise<void> {
  const tmp = join(tmpdir(), `keynv-mcp-spike-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const serverPath = join(tmp, 'server.mjs');
  writeFileSync(serverPath, SERVER_SOURCE);

  const child = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });
  if (!child.stdin || !child.stdout) throw new Error('failed to spawn child');

  const samples: number[] = [];
  let buf = '';
  let pendingId = 0;
  let pendingStart = 0n;
  let resolver: ((latency: number) => void) | null = null;

  child.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let idx: number;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic line iteration
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const res = JSON.parse(line);
        if (res.id === pendingId && resolver) {
          const latency = Number(process.hrtime.bigint() - pendingStart) / 1_000_000;
          resolver(latency);
          resolver = null;
        }
      } catch {
        // ignore
      }
    }
  });

  for (let i = 0; i < REQUESTS; i++) {
    pendingId = i + 1;
    const req = `${JSON.stringify({ jsonrpc: '2.0', id: pendingId, method: 'who_am_i' })}\n`;
    pendingStart = process.hrtime.bigint();
    const latency = await new Promise<number>((resolve) => {
      resolver = resolve;
      child.stdin?.write(req);
    });
    samples.push(latency);
  }

  child.kill();

  const median = pickStat(samples, 0.5);
  const p95 = pickStat(samples, 0.95);

  console.log('');
  console.log('MCP stdio round-trip spike');
  console.log('─────────────────────────────────────────');
  console.log(`requests:      ${REQUESTS}`);
  console.log(`median:        ${median.toFixed(2)} ms`);
  console.log(`p95:           ${p95.toFixed(2)} ms`);
  console.log('─────────────────────────────────────────');

  if (median > HARD_FAIL_MS) {
    console.log(`HARD FAIL: median ${median.toFixed(2)} ms > ${HARD_FAIL_MS} ms`);
    process.exit(1);
  } else if (median > TARGET_MS) {
    console.log(`WARN: median ${median.toFixed(2)} ms > target ${TARGET_MS} ms`);
  } else {
    console.log(`OK: median ${median.toFixed(2)} ms within target ${TARGET_MS} ms.`);
  }

  rmSync(tmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
