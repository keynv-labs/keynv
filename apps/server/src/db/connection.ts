import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface OpenDbOptions {
  /** Filesystem path to the SQLite file. Use `:memory:` for tests. */
  path: string;
  /** When true, runs all unapplied migrations from src/db/migrations/. */
  migrate?: boolean;
  /** When true, prints applied migrations on stdout. */
  verbose?: boolean;
}

const MIGRATION_BOOKKEEPING_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name        TEXT PRIMARY KEY,
    applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

function migrationsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'migrations');
}

function applyMigrations(raw: Database.Database, verbose: boolean): void {
  raw.exec(MIGRATION_BOOKKEEPING_DDL);
  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const stmt = raw.prepare('SELECT 1 FROM schema_migrations WHERE name = ?');
  const insert = raw.prepare('INSERT INTO schema_migrations (name) VALUES (?)');
  for (const file of files) {
    if (stmt.get(file)) continue;
    const sqlText = readFileSync(join(dir, file), 'utf8');
    raw.exec('BEGIN');
    try {
      raw.exec(sqlText);
      insert.run(file);
      raw.exec('COMMIT');
      if (verbose) console.log(`migration applied: ${file}`);
    } catch (err) {
      raw.exec('ROLLBACK');
      throw err;
    }
  }
}

/**
 * Opens a SQLite-backed Drizzle handle. WAL mode + synchronous=NORMAL
 * for the throughput profile validated in the Phase 0 spike.
 */
export function openDb(opts: OpenDbOptions): { db: Db; raw: Database.Database } {
  const raw = new Database(opts.path);
  raw.pragma('journal_mode = WAL');
  raw.pragma('synchronous = NORMAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('busy_timeout = 5000');

  if (opts.migrate) applyMigrations(raw, opts.verbose ?? false);

  const db = drizzle(raw, { schema });
  return { db, raw };
}
