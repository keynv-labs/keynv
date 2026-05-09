/**
 * Phase 0 spike: libsodium throughput.
 *
 * Measures crypto_secretbox encrypt + decrypt round-trips at several
 * payload sizes. Used to confirm the crypto layer will not be a
 * bottleneck for normal keynv workloads.
 *
 * Targets:
 *  - 32-byte payload: > 100K ops/s
 *  - 1 KB payload:    > 30K ops/s
 *  - 4 KB payload:    > 10K ops/s
 */

// libsodium-wrappers ships an ESM build whose internal `import 'libsodium'`
// confuses tsx's bare-specifier resolver. Loading via createRequire sidesteps
// the issue and matches how the production server will load the module
// inside a Node-CJS context anyway.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// biome-ignore lint/suspicious/noExplicitAny: third-party CJS module without first-class ESM types
const sodium: any = require('libsodium-wrappers');

const SIZES = [32, 1024, 4096];
const ITERATIONS_BY_SIZE: Record<number, number> = {
  32: 200_000,
  1024: 60_000,
  4096: 20_000,
};
const TARGETS_OPS_PER_S: Record<number, number> = {
  32: 100_000,
  1024: 30_000,
  4096: 10_000,
};

async function main(): Promise<void> {
  await sodium.ready;

  const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);

  console.log('');
  console.log('libsodium secretbox throughput spike');
  console.log('─────────────────────────────────────────────────────────');
  console.log('payload   iters    encrypt ops/s   decrypt ops/s   verdict');

  let allOk = true;

  for (const size of SIZES) {
    const iter = ITERATIONS_BY_SIZE[size] ?? 1000;
    const target = TARGETS_OPS_PER_S[size] ?? 1000;
    const message = sodium.randombytes_buf(size);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    // Encrypt
    const encStart = process.hrtime.bigint();
    let lastCipher: Uint8Array = new Uint8Array(0);
    for (let i = 0; i < iter; i++) {
      lastCipher = sodium.crypto_secretbox_easy(message, nonce, key);
    }
    const encMs = Number(process.hrtime.bigint() - encStart) / 1_000_000;
    const encOpsPerSec = (iter * 1000) / encMs;

    // Decrypt
    const decStart = process.hrtime.bigint();
    for (let i = 0; i < iter; i++) {
      sodium.crypto_secretbox_open_easy(lastCipher, nonce, key);
    }
    const decMs = Number(process.hrtime.bigint() - decStart) / 1_000_000;
    const decOpsPerSec = (iter * 1000) / decMs;

    const minOps = Math.min(encOpsPerSec, decOpsPerSec);
    const verdict = minOps >= target ? 'OK' : 'FAIL';
    if (verdict === 'FAIL') allOk = false;

    console.log(
      `${String(size).padStart(5)} B  ${String(iter).padStart(7)}    ${encOpsPerSec.toFixed(0).padStart(13)}   ${decOpsPerSec.toFixed(0).padStart(13)}   ${verdict}`,
    );
  }

  console.log('─────────────────────────────────────────────────────────');
  if (!allOk) {
    console.log('HARD FAIL: at least one size missed its target.');
    console.log('Consider switching to @noble/ciphers (pure JS) or sodium-native (C bindings).');
    process.exit(1);
  }
  console.log('OK: all payload sizes within target.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
