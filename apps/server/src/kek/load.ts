import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { crypto } from '@keynv/core';

/**
 * Loads the master KEK from `path`. If `generateIfMissing`, creates a
 * new key, writes it to `path` with mode 0400, and returns it. Returns
 * the raw 32-byte key.
 *
 * The caller is responsible for keeping the loaded key in memory only
 * as long as needed and zeroing it on shutdown.
 */
export async function loadOrCreateKek(opts: {
  path: string;
  generateIfMissing?: boolean;
}): Promise<Uint8Array> {
  if (existsSync(opts.path)) {
    const raw = readFileSync(opts.path);
    if (raw.length !== 32) {
      throw new Error(`keynv: master key file ${opts.path} is not 32 bytes (got ${raw.length}).`);
    }
    return new Uint8Array(raw);
  }
  if (!opts.generateIfMissing) {
    throw new Error(`keynv: master key file ${opts.path} not found. Run 'keynv-server bootstrap'.`);
  }
  const fresh = await crypto.generateKey();
  writeFileSync(opts.path, fresh, { mode: 0o400 });
  try {
    chmodSync(opts.path, 0o400);
  } catch {
    // best-effort on platforms that don't support chmod
  }
  return fresh;
}
