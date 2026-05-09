import pino from 'pino';

/**
 * Structured logger. Configured to redact common credential-shaped
 * fields aggressively — defense-in-depth in case a route handler
 * forgets to sanitize before logging.
 */
export function makeLogger(level = 'info') {
  return pino({
    level,
    redact: {
      paths: [
        '*.password',
        '*.password_hash',
        '*.access_token',
        '*.refresh_token',
        '*.token',
        '*.value',
        '*.dek',
        '*.kek',
        '*.dek_wrapped',
        '*.ciphertext',
        '*.nonce',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      remove: false,
      censor: '[redacted]',
    },
  });
}

export type Logger = ReturnType<typeof makeLogger>;
