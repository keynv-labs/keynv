import type { Context } from 'hono';

/**
 * Canonical error codes returned to the client. Documented in
 * docs/06-api-spec.md §error catalog.
 */
export type ErrorCode =
  | 'auth.invalid_credentials'
  | 'auth.token_expired'
  | 'auth.token_revoked'
  | 'auth.missing_token'
  | 'rbac.denied'
  | 'rbac.approval_required'
  | 'project.not_found'
  | 'project.already_exists'
  | 'environment.not_found'
  | 'secret.not_found'
  | 'secret.already_exists'
  | 'secret.invalid_alias'
  | 'user.not_found'
  | 'user.already_exists'
  | 'membership.not_found'
  | 'validation.failed'
  | 'rate_limited'
  | 'internal_error';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  'auth.invalid_credentials': 401,
  'auth.token_expired': 401,
  'auth.token_revoked': 401,
  'auth.missing_token': 401,
  'rbac.denied': 403,
  'rbac.approval_required': 202,
  'project.not_found': 404,
  'project.already_exists': 409,
  'environment.not_found': 404,
  'secret.not_found': 404,
  'secret.already_exists': 409,
  'secret.invalid_alias': 400,
  'user.not_found': 404,
  'user.already_exists': 409,
  'membership.not_found': 404,
  'validation.failed': 400,
  'rate_limited': 429,
  'internal_error': 500,
};

export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export function jsonError(c: Context, code: ErrorCode, message: string, details?: Record<string, unknown>) {
  const body: { error: ApiError } = {
    error: { code, message, ...(details ? { details } : {}) },
  };
  // biome-ignore lint/suspicious/noExplicitAny: hono's status type is a complex literal union
  return c.json(body, STATUS_BY_CODE[code] as any);
}
