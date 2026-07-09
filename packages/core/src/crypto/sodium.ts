// libsodium-wrappers ships an ESM build whose internal `import 'libsodium'`
// trips up some bundlers; loading via createRequire keeps the module path
// stable across Node, Bun, and tsx.
import { createRequire } from 'node:module';
import { join } from 'node:path';

interface Sodium {
  ready: Promise<void>;
  randombytes_buf(length: number): Uint8Array;
  crypto_secretbox_easy(message: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  crypto_secretbox_open_easy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  memzero(buf: Uint8Array): void;
}

const moduleRequire = createRequire(import.meta.url);

function loadSodiumModule(): Sodium {
  try {
    return moduleRequire('libsodium-wrappers') as Sodium;
  } catch {
    // Next standalone can preserve workspace-absolute module origins, so fall
    // back to resolving from the runtime app root where copied dependencies live.
    const runtimeRequire = createRequire(join(process.cwd(), 'package.json'));
    return runtimeRequire('libsodium-wrappers') as Sodium;
  }
}

const sodium = loadSodiumModule();

let readyPromise: Promise<Sodium> | null = null;

/**
 * Returns a fully-initialized libsodium handle. Calling sites must `await`
 * this before using any crypto primitive — libsodium loads its WASM
 * module asynchronously.
 */
export function loadSodium(): Promise<Sodium> {
  if (!readyPromise) {
    readyPromise = sodium.ready.then(() => sodium);
  }
  return readyPromise;
}

/**
 * Best-effort zeroing of a sensitive buffer. Falls back to a JS-side
 * fill when libsodium's `memzero` is unavailable (it always is in WASM
 * builds, but documenting the fallback explicitly).
 */
export function zero(buf: Uint8Array): void {
  if (typeof sodium.memzero === 'function') {
    sodium.memzero(buf);
    return;
  }
  buf.fill(0);
}
