import { z } from 'zod';
import type { ZodType, ZodTypeDef } from 'zod';

export const testerEnum = z.enum(['postgres', 'mysql', 'redis', 'ssh', 'http']);
export type TesterType = z.infer<typeof testerEnum>;

/**
 * The plaintext value resolved from an alias, plus optional auxiliary
 * fields some testers need (e.g., username for SSH keypair auth).
 *
 * The runner constructs this once, hands it to the tester, and never
 * persists or logs the value.
 */
export interface ResolvedSecret {
  readonly alias: string;
  readonly value: string;
  readonly fields?: Readonly<Record<string, string>>;
}

/**
 * Per-tester target shape (database host/port/db, ssh host/user, http
 * url/auth-style, etc.). Each tester ships its own zod schema.
 */
export type TesterTarget = Readonly<Record<string, unknown>>;

export interface TestResult {
  readonly ok: boolean;
  readonly latency_ms: number;
  /** Sanitized — must NEVER carry the resolved secret value. */
  readonly error?: string;
  /** Optional structured info (server version, identity hash, etc.). */
  readonly info?: Readonly<Record<string, unknown>>;
}

export interface Tester<T extends TesterTarget = TesterTarget> {
  readonly type: TesterType;
  /**
   * The schema's *input* type stays unknown so callers (the CLI's
   * --target k=v parser, the MCP tool) can hand untyped objects in;
   * zod's defaults / coercions turn them into the strongly-typed
   * output the tester sees.
   */
  readonly schema: ZodType<T, ZodTypeDef, unknown>;
  test(secret: ResolvedSecret, target: T): Promise<TestResult>;
}

export const DEFAULT_TIMEOUT_MS = 5_000;
