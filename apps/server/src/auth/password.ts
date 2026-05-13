import argon2 from 'argon2';

const opts: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function configureArgon2(overrides: {
  memoryKib?: number;
  timeCost?: number;
  parallelism?: number;
}): void {
  if (overrides.memoryKib !== undefined) opts.memoryCost = overrides.memoryKib;
  if (overrides.timeCost !== undefined) opts.timeCost = overrides.timeCost;
  if (overrides.parallelism !== undefined) opts.parallelism = overrides.parallelism;
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, opts);
}

/**
 * Verifies a candidate password against a stored hash. Returns false
 * (rather than throwing) on any verification failure; callers decide
 * how to respond (always with the same generic message — never leak
 * which credential was wrong).
 */
export async function verifyPassword(hash: string, candidate: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, candidate);
  } catch {
    return false;
  }
}
