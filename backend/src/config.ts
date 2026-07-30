/**
 * Centralised, validated configuration.
 * Fails fast at startup if a required secret is missing in production.
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('1h'),

  DATABASE_URL: z.string().optional(),

  // Pass-through auth: each user signs in with THEIR OWN Peeredge credentials,
  // so the server holds no Peeredge login of its own — only where to reach it.
  PEEREDGE_SOURCE: z.enum(['mock', 'rest']).default('mock'),
  PEEREDGE_BASE_URL: z.string().url().optional().or(z.literal('')), // https://api-<slug>.peeredge.com
  PEEREDGE_SLUG: z.string().default('dialphone'), // <slug>; used for the Referer header
  PEEREDGE_LOGIN_PATH: z.string().default('/api/v2/relationship/auth/login'), // carrier login

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// Cross-field validation for rest mode: we only need to know where Peeredge is.
if (env.PEEREDGE_SOURCE === 'rest' && !env.PEEREDGE_BASE_URL) {
  // eslint-disable-next-line no-console
  console.error('PEEREDGE_SOURCE=rest requires PEEREDGE_BASE_URL');
  process.exit(1);
}

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
} as const;

export type Config = typeof config;
