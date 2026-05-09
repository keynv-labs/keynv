import pino from 'pino';
import { redact } from '@keynv/redactor';

/**
 * Structured logger. Three layers of secret protection:
 *
 *  1. `redact.paths` scrubs known credential-shaped fields by name.
 *  2. The custom `err` serializer runs the redactor pattern bank over
 *     the error message and stack so driver-level exceptions that
 *     embed a connection-string in their text get masked before the
 *     line hits stdout (audit finding H5).
 *  3. The whole logger is silenced when level === 'silent', which
 *     tests use to keep their output clean.
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
    serializers: {
      err: (err: unknown) => {
        if (err instanceof Error) {
          return {
            type: err.name,
            message: redact(err.message).text,
            // pino prints the stack as `err.stack`; sanitize it too.
            stack: err.stack ? redact(err.stack).text : undefined,
            ...(err.cause ? { cause: redact(String(err.cause)).text } : {}),
          };
        }
        return { value: redact(String(err)).text };
      },
    },
  });
}

export type Logger = ReturnType<typeof makeLogger>;
