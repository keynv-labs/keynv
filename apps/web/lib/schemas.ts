import { z } from 'zod';

export const projectId = z.string().min(1);

export const email = z.string().email();

export const password = z.string().min(1);

export const passwordMin12 = z.string().min(12).max(256);

export const orgName = z.string().min(1).max(64);

export const projectName = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase kebab-case only');

export const envName = z
  .string()
  .min(1)
  .max(24)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

export const envTier = z.enum(['production', 'non-production']).default('non-production');

export const requireApproval = z.boolean().default(false);

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
export const secretKey = z.string().min(1).max(64).regex(KEY_RE);

export const secretValue = z.string().min(0).max(64 * 1024);

export const projectRole = z.enum(['lead', 'developer', 'reader']);

export const orgRole = z.enum(['admin', 'developer', 'reader']);

export const testerName = z.enum(['postgres', 'mysql', 'redis', 'ssh', 'http']);

export const cliTokenName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/, 'Letters, digits, _ . - and spaces only');

export const approvalReason = z.string().max(500).optional();

export const expiresInSeconds = z.coerce.number().int().positive().max(7 * 24 * 3600);

export const EnvSpec = z.object({
  name: envName,
  tier: envTier,
  require_approval: requireApproval,
});
