import { z } from 'zod';

const Schema = z.object({
  KEYNV_SERVER_URL: z.string().url().default('http://localhost:8080'),
  KEYNV_WEB_SESSION_SECRET: z.string().min(32).optional(),
});

export const env = Schema.parse({
  KEYNV_SERVER_URL: process.env.KEYNV_SERVER_URL,
  KEYNV_WEB_SESSION_SECRET: process.env.KEYNV_WEB_SESSION_SECRET,
});
