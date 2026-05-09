/**
 * Phase 0 spike: SQLite WAL audit-chain insert throughput.
 *
 * Inserts 100K rows into a hash-chained audit table (mimicking
 * apps/server/src/db/schema.ts) with `synchronous=NORMAL`, WAL mode,
 * and a single transaction-per-row baseline plus a batched-by-1000
 * comparison. Reports rows/sec and tail latency.
 *
 * Targets:
 *  - Single-row inserts: > 5K rows/s sustained
 *  - Batched (1000/tx):  > 50K rows/s sustained
 */

import Database from 'better-sqlite3';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROWS = 100_000;
const BATCH = 1000;
const SINGLE_TARGET = 5_000;
const BATCH_TARGET = 50_000;

interface Run {
  label: string;
  rows: number;
  ms: number;
  ratePerSec: number;
}

function tableSetup(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit (
      id          INTEGER PRIMARY KEY,
      prev_hash   TEXT NOT NULL,
      hash        TEXT NOT NULL,
      ts          TEXT NOT NULL,
      actor       TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      payload     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts);
  `);
}

function nextHash(prev: string, payload: string, ts: string, actor: string): string {
  return createHash('sha256').update(prev).update(payload).update(ts).update(actor).digest('hex');
}

function fakePayload(): string {
  return JSON.stringify({
    alias: `@proj-${Math.floor(Math.random() * 100)}.dev.k_${Math.floor(Math.random() * 1000)}`,
    nonce: randomBytes(8).toString('hex'),
  });
}

function runSingle(db: Database.Database, n: number): Run {
  const insert = db.prepare(
    'INSERT INTO audit (prev_hash, hash, ts, actor, event_type, payload) VALUES (?, ?, ?, ?, ?, ?)',
  );
  let prev = '0'.repeat(64);
  const start = process.hrtime.bigint();
  for (let i = 0; i < n; i++) {
    const ts = new Date().toISOString();
    const payload = fakePayload();
    const h = nextHash(prev, payload, ts, 'u_actor');
    insert.run(prev, h, ts, 'u_actor', 'secret.read.allowed', payload);
    prev = h;
  }
  const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
  return { label: 'single insert/tx', rows: n, ms, ratePerSec: (n * 1000) / ms };
}

function runBatched(db: Database.Database, n: number, batch: number): Run {
  const insert = db.prepare(
    'INSERT INTO audit (prev_hash, hash, ts, actor, event_type, payload) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertMany = db.transaction(
    (entries: Array<{ prev: string; hash: string; ts: string; payload: string }>) => {
      for (const e of entries) {
        insert.run(e.prev, e.hash, e.ts, 'u_actor', 'secret.read.allowed', e.payload);
      }
    },
  );

  let prev = '0'.repeat(64);
  const start = process.hrtime.bigint();
  let written = 0;
  while (written < n) {
    const size = Math.min(batch, n - written);
    const entries: Array<{ prev: string; hash: string; ts: string; payload: string }> = [];
    for (let i = 0; i < size; i++) {
      const ts = new Date().toISOString();
      const payload = fakePayload();
      const h = nextHash(prev, payload, ts, 'u_actor');
      entries.push({ prev, hash: h, ts, payload });
      prev = h;
    }
    insertMany(entries);
    written += size;
  }
  const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
  return { label: `batched ${batch}/tx`, rows: n, ms, ratePerSec: (n * 1000) / ms };
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function main(): void {
  const tmp = join(tmpdir(), `keynv-sqlite-spike-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const dbPath = join(tmp, 'audit.db');

  const dbA = new Database(dbPath);
  tableSetup(dbA);
  const single = runSingle(dbA, ROWS);
  dbA.close();

  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });

  const dbB = new Database(dbPath);
  tableSetup(dbB);
  const batched = runBatched(dbB, ROWS, BATCH);
  dbB.close();

  console.log('');
  console.log('SQLite audit-chain insert spike');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('mode               rows     elapsed     rows/s       verdict');
  for (const run of [single, batched]) {
    const target = run.label.startsWith('single') ? SINGLE_TARGET : BATCH_TARGET;
    const verdict = run.ratePerSec >= target ? 'OK' : 'FAIL';
    console.log(
      `${run.label.padEnd(18)} ${fmt(run.rows).padStart(7)}  ${(run.ms / 1000).toFixed(2)}s   ${fmt(Math.round(run.ratePerSec)).padStart(8)}     ${verdict}`,
    );
  }
  console.log('─────────────────────────────────────────────────────────────');

  rmSync(tmp, { recursive: true, force: true });

  if (single.ratePerSec < SINGLE_TARGET || batched.ratePerSec < BATCH_TARGET) {
    console.log('HARD FAIL: insert throughput below target.');
    process.exit(1);
  }
  console.log('OK: SQLite insert throughput meets targets for a 15-person team workload.');
}

main();
