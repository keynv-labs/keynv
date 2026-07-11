import { z } from 'zod';

const Schema = z.object({
  KEYNV_SERVER_URL: z.string().url().default('http://localhost:8080'),
  KEYNV_WEB_SESSION_SECRET: z.string().min(32).optional(),
});

// Treat empty-string vars (compose `${VAR:-}` defaults) as unset so the
// schema default / optional applies instead of failing validation.
const clean = (v: string | undefined): string | undefined => (v ? v : undefined);

export const env = Schema.parse({
  KEYNV_SERVER_URL: clean(process.env.KEYNV_SERVER_URL),
  KEYNV_WEB_SESSION_SECRET: clean(process.env.KEYNV_WEB_SESSION_SECRET),
});
