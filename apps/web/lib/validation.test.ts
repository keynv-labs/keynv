import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { email, password, passwordMin12, projectId, envName, secretKey, secretValue, projectRole, cliTokenName, orgName } from '@/lib/schemas';

const loginSchema = z.object({
  email,
  password,
  next: z.string().optional(),
});

const registerSchema = z.object({
  email,
  password: passwordMin12,
  org_name: orgName,
});

const createSecretSchema = z.object({
  project_id: projectId,
  env: envName,
  key: secretKey,
  value: secretValue,
});

const addMemberSchema = z.object({
  project_id: projectId,
  email,
  role: projectRole,
});

const cliTokenSchema = z.object({
  name: cliTokenName,
  expires_in_days: z.coerce.number().int().min(1).max(365).optional(),
});

describe('Login validation', () => {
  it('accepts valid login data', () => {
    const r = loginSchema.safeParse({ email: 'user@example.com', password: 's3cret' });
    expect(r.success).toBe(true);
  });

  it('rejects missing password', () => {
    const r = loginSchema.safeParse({ email: 'user@example.com' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const r = loginSchema.safeParse({ email: 'not-email', password: 'pwd' });
    expect(r.success).toBe(false);
  });

  it('accepts optional next param', () => {
    const r = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'pwd',
      next: '/dashboard',
    });
    expect(r.success).toBe(true);
  });
});

describe('Register validation', () => {
  it('accepts valid registration', () => {
    const r = registerSchema.safeParse({
      email: 'new@example.com',
      password: 'correct-horse-battery-staple',
      org_name: 'My Org',
    });
    expect(r.success).toBe(true);
  });

  it('rejects short password (< 12 chars)', () => {
    const r = registerSchema.safeParse({
      email: 'new@example.com',
      password: 'short',
      org_name: 'Org',
    });
    expect(r.success).toBe(false);
  });

  it('rejects long password (> 256 chars)', () => {
    const r = registerSchema.safeParse({
      email: 'new@example.com',
      password: 'a'.repeat(257),
      org_name: 'Org',
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing org_name', () => {
    const r = registerSchema.safeParse({
      email: 'new@example.com',
      password: 'correct-horse-battery-staple',
    });
    expect(r.success).toBe(false);
  });
});

describe('Create secret validation', () => {
  it('accepts valid secret data', () => {
    const r = createSecretSchema.safeParse({
      project_id: 'proj_abc',
      env: 'production',
      key: 'DATABASE_URL',
      value: 'postgres://...',
    });
    expect(r.success).toBe(true);
  });

  it('rejects env with uppercase', () => {
    const r = createSecretSchema.safeParse({
      project_id: 'proj_abc',
      env: 'Production',
      key: 'KEY',
      value: 'val',
    });
    expect(r.success).toBe(false);
  });

  it('rejects env longer than 24 chars', () => {
    const r = createSecretSchema.safeParse({
      project_id: 'proj_abc',
      env: 'a-really-long-environment-name-123',
      key: 'KEY',
      value: 'val',
    });
    expect(r.success).toBe(false);
  });

  it('rejects key with invalid characters', () => {
    const r = createSecretSchema.safeParse({
      project_id: 'proj_abc',
      env: 'dev',
      key: 'MY.KEY',
      value: 'val',
    });
    expect(r.success).toBe(false);
  });

  it('rejects key longer than 64 chars', () => {
    const r = createSecretSchema.safeParse({
      project_id: 'proj_abc',
      env: 'dev',
      key: 'A'.repeat(65),
      value: 'val',
    });
    expect(r.success).toBe(false);
  });

  it('accepts empty value', () => {
    const r = createSecretSchema.safeParse({
      project_id: 'proj_abc',
      env: 'dev',
      key: 'EMPTY',
      value: '',
    });
    expect(r.success).toBe(true);
  });

  it('rejects value larger than 64KB', () => {
    const r = createSecretSchema.safeParse({
      project_id: 'proj_abc',
      env: 'dev',
      key: 'BIG',
      value: 'x'.repeat(64 * 1024 + 1),
    });
    expect(r.success).toBe(false);
  });
});

describe('Add member validation', () => {
  it('accepts valid member data', () => {
    const r = addMemberSchema.safeParse({
      project_id: 'proj_abc',
      email: 'dev@example.com',
      role: 'developer',
    });
    expect(r.success).toBe(true);
  });

  it('accepts lead role', () => {
    const r = addMemberSchema.safeParse({
      project_id: 'proj_abc',
      email: 'lead@example.com',
      role: 'lead',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown role', () => {
    const r = addMemberSchema.safeParse({
      project_id: 'proj_abc',
      email: 'user@example.com',
      role: 'admin',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const r = addMemberSchema.safeParse({
      project_id: 'proj_abc',
      email: 'not-email',
      role: 'reader',
    });
    expect(r.success).toBe(false);
  });
});

describe('CLI token validation', () => {
  it('accepts valid token name', () => {
    const r = cliTokenSchema.safeParse({ name: 'My Dev Token' });
    expect(r.success).toBe(true);
  });

  it('accepts expires_in_days', () => {
    const r = cliTokenSchema.safeParse({ name: 'token', expires_in_days: '30' });
    expect(r.success).toBe(true);
  });

  it('rejects expires_in_days of 0', () => {
    const r = cliTokenSchema.safeParse({ name: 'token', expires_in_days: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects expires_in_days > 365', () => {
    const r = cliTokenSchema.safeParse({ name: 'token', expires_in_days: 400 });
    expect(r.success).toBe(false);
  });

  it('rejects name with special characters', () => {
    const r = cliTokenSchema.safeParse({ name: 'token@#$' });
    expect(r.success).toBe(false);
  });
});
