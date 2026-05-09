import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  generateKey,
  KEY_BYTES,
  NONCE_BYTES,
  unwrapDek,
  wrapDek,
} from './index.js';

describe('generateKey', () => {
  it('produces 32 bytes', async () => {
    const k = await generateKey();
    expect(k).toBeInstanceOf(Uint8Array);
    expect(k.length).toBe(KEY_BYTES);
  });

  it('produces unique keys across calls', async () => {
    const a = await generateKey();
    const b = await generateKey();
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

describe('wrapDek / unwrapDek', () => {
  it('round-trips a DEK through a KEK', async () => {
    const kek = await generateKey();
    const dek = await generateKey();
    const wrapped = await wrapDek(dek, kek);
    expect(wrapped.nonce.length).toBe(NONCE_BYTES);
    expect(wrapped.ciphertext.length).toBeGreaterThan(0);

    const unwrapped = await unwrapDek(wrapped, kek);
    expect(Buffer.from(unwrapped).equals(Buffer.from(dek))).toBe(true);
  });

  it('produces a different nonce on each wrap', async () => {
    const kek = await generateKey();
    const dek = await generateKey();
    const a = await wrapDek(dek, kek);
    const b = await wrapDek(dek, kek);
    expect(Buffer.from(a.nonce).equals(Buffer.from(b.nonce))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it('rejects unwrap with the wrong KEK', async () => {
    const kek = await generateKey();
    const wrongKek = await generateKey();
    const dek = await generateKey();
    const wrapped = await wrapDek(dek, kek);
    await expect(unwrapDek(wrapped, wrongKek)).rejects.toThrow();
  });

  it('rejects unwrap with tampered ciphertext', async () => {
    const kek = await generateKey();
    const dek = await generateKey();
    const wrapped = await wrapDek(dek, kek);
    const tampered = new Uint8Array(wrapped.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    await expect(unwrapDek({ ...wrapped, ciphertext: tampered }, kek)).rejects.toThrow();
  });

  it('rejects unwrap with tampered nonce', async () => {
    const kek = await generateKey();
    const dek = await generateKey();
    const wrapped = await wrapDek(dek, kek);
    const tampered = new Uint8Array(wrapped.nonce);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    await expect(unwrapDek({ ...wrapped, nonce: tampered }, kek)).rejects.toThrow();
  });

  it('throws when called with wrong-length keys', async () => {
    const dek = await generateKey();
    const tooShort = new Uint8Array(16);
    await expect(wrapDek(dek, tooShort)).rejects.toThrow(/32 bytes/);
    await expect(wrapDek(tooShort, dek)).rejects.toThrow(/32 bytes/);
  });
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips an ASCII string', async () => {
    const dek = await generateKey();
    const sealed = await encryptSecret('hello world', dek);
    expect(await decryptSecret(sealed, dek)).toBe('hello world');
  });

  it('round-trips a UTF-8 multibyte string', async () => {
    const dek = await generateKey();
    const value = 'şifre 🔑 пароль';
    const sealed = await encryptSecret(value, dek);
    expect(await decryptSecret(sealed, dek)).toBe(value);
  });

  it('round-trips an empty string', async () => {
    const dek = await generateKey();
    const sealed = await encryptSecret('', dek);
    expect(await decryptSecret(sealed, dek)).toBe('');
  });

  it('round-trips a 16 KB value', async () => {
    const dek = await generateKey();
    const value = 'x'.repeat(16 * 1024);
    const sealed = await encryptSecret(value, dek);
    expect(await decryptSecret(sealed, dek)).toBe(value);
  });

  it('produces a fresh nonce per call (CPA-safe)', async () => {
    const dek = await generateKey();
    const a = await encryptSecret('same', dek);
    const b = await encryptSecret('same', dek);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it('rejects decrypt with the wrong DEK', async () => {
    const dek = await generateKey();
    const wrongDek = await generateKey();
    const sealed = await encryptSecret('secret', dek);
    await expect(decryptSecret(sealed, wrongDek)).rejects.toThrow();
  });

  it('rejects decrypt with tampered ciphertext', async () => {
    const dek = await generateKey();
    const sealed = await encryptSecret('secret', dek);
    const tampered = new Uint8Array(sealed.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0x01;
    await expect(decryptSecret({ ...sealed, ciphertext: tampered }, dek)).rejects.toThrow();
  });
});

describe('property tests', () => {
  it('every wrap roundtrips for any DEK/KEK pair', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 32, maxLength: 32 }), async (kekBytes) => {
        const kek = new Uint8Array(kekBytes);
        const dek = await generateKey();
        const wrapped = await wrapDek(dek, kek);
        const unwrapped = await unwrapDek(wrapped, kek);
        expect(Buffer.from(unwrapped).equals(Buffer.from(dek))).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it('every encrypt roundtrips for any UTF-8 string', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 1024 }), async (value) => {
        const dek = await generateKey();
        const sealed = await encryptSecret(value, dek);
        expect(await decryptSecret(sealed, dek)).toBe(value);
      }),
      { numRuns: 50 },
    );
  });
});
