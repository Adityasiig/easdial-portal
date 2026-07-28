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

  PEEREDGE_SOURCE: z.enum(['mock', 'rest']).default('mock'),
  PEEREDGE_BASE_URL: z.string().url().optional().or(z.literal('')),
  PEEREDGE_ORIGIN: z.string().default('https://carrier-dialphone.peeredge.com'),

  // Auth to the PeerEdge relationship API (cookie-based; no API key exists).
  PEEREDGE_AUTH_MODE: z.enum(['cookie', 'login']).default('cookie'),
  PEEREDGE_SESSION_COOKIE: z.string().optional(),
  PEEREDGE_LOGIN_URL: z.string().url().optional().or(z.literal('')),
  PEEREDGE_EMAIL: z.string().optional(),
  PEEREDGE_PASSWORD: z.string().optional(),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PORTAL_BASE_URL: z.string().default('http://localhost:5173'),

  // First-user seeding. Always on in dev; in production only when SEED_DEMO=true.
  // Lets you create an initial login on a fresh deploy without a database.
  SEED_DEMO: z.enum(['true', 'false']).default('false'),
  SEED_DEMO_EMAIL: z.string().email().default('carrier@easdial.com'),
  SEED_DEMO_PASSWORD: z.string().min(8).default('EasDialDemo!2026'),
  SEED_DEMO_RELATIONSHIP: z.string().default('REL-1001'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// Cross-field validation for rest mode.
if (env.PEEREDGE_SOURCE === 'rest') {
  if (!env.PEEREDGE_BASE_URL) {
    // eslint-disable-next-line no-console
    console.error('PEEREDGE_SOURCE=rest requires PEEREDGE_BASE_URL');
    process.exit(1);
  }
  if (env.PEEREDGE_AUTH_MODE === 'cookie' && !env.PEEREDGE_SESSION_COOKIE) {
    // eslint-disable-next-line no-console
    console.error('PEEREDGE_AUTH_MODE=cookie requires PEEREDGE_SESSION_COOKIE');
    process.exit(1);
  }
  if (
    env.PEEREDGE_AUTH_MODE === 'login' &&
    (!env.PEEREDGE_LOGIN_URL || !env.PEEREDGE_EMAIL || !env.PEEREDGE_PASSWORD)
  ) {
    // eslint-disable-next-line no-console
    console.error('PEEREDGE_AUTH_MODE=login requires PEEREDGE_LOGIN_URL, PEEREDGE_EMAIL, PEEREDGE_PASSWORD');
    process.exit(1);
  }
}

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
} as const;

export type Config = typeof config;
