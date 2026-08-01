/**
 * Centralised, validated configuration.
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('12h'),

  // ---- EasDial admin (seeds the first admin account so you can log in) ----
  EASDIAL_ADMIN_EMAIL: z.string().email().default('admin@easdial.com'),
  EASDIAL_ADMIN_PASSWORD: z.string().min(8).default('changeme_admin_password'),

  // Optional outside Docker/tests. Production compose supplies this so portal
  // accounts survive backend restarts and deployments.
  DATABASE_URL: z.string().url().optional().or(z.literal('')),

  // ---- Data source ----
  // "mock" (synthetic, no creds) or "rest" (live DialPhone admin API).
  PEEREDGE_SOURCE: z.enum(['mock', 'rest', 'relationship']).default('mock'),
  PEEREDGE_BASE_URL: z.string().url().optional().or(z.literal('')), // https://api-<slug>.peeredge.com
  PEEREDGE_SLUG: z.string().default('dialphone'),
  PEEREDGE_BRAND_PREFIX: z.string().default('ED'), // relationships shown = <prefix>- ...

  // ---- Switch-admin SERVICE login (one account reads the whole switch) ----
  PEEREDGE_ADMIN_EMAIL: z.string().optional(),
  PEEREDGE_ADMIN_PASSWORD: z.string().optional(),
  PEEREDGE_ADMIN_LOGIN_PATH: z.string().default('/api/v2/login'),

  // ---- Single relationship login (verified carrier-portal contract) ----
  PEEREDGE_RELATIONSHIP_USERNAME: z.string().optional(),
  PEEREDGE_RELATIONSHIP_PASSWORD: z.string().optional(),
  PEEREDGE_RELATIONSHIP_NAME: z.string().default('EasDial Relationship'),
  PEEREDGE_RELATIONSHIP_LOGIN_PATH: z.string().default('/login'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;

// rest mode needs the switch-admin service credentials + base URL.
if (env.PEEREDGE_SOURCE === 'rest') {
  if (!env.PEEREDGE_BASE_URL || !env.PEEREDGE_ADMIN_EMAIL || !env.PEEREDGE_ADMIN_PASSWORD) {
    // eslint-disable-next-line no-console
    console.error(
      'PEEREDGE_SOURCE=rest requires PEEREDGE_BASE_URL, PEEREDGE_ADMIN_EMAIL, PEEREDGE_ADMIN_PASSWORD',
    );
    process.exit(1);
  }
}

if (env.PEEREDGE_SOURCE === 'relationship') {
  if (!env.PEEREDGE_BASE_URL || !env.PEEREDGE_RELATIONSHIP_USERNAME || !env.PEEREDGE_RELATIONSHIP_PASSWORD) {
    // eslint-disable-next-line no-console
    console.error(
      'PEEREDGE_SOURCE=relationship requires PEEREDGE_BASE_URL, PEEREDGE_RELATIONSHIP_USERNAME, PEEREDGE_RELATIONSHIP_PASSWORD',
    );
    process.exit(1);
  }
}

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
} as const;

export type Config = typeof config;
