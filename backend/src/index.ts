import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { buildServer } from './server.js';
import { InMemoryUserStore } from './services/userStore.js';

/**
 * Seed an initial login so the portal is usable on a fresh deploy (the store is
 * in-memory in Phase 1). Runs automatically in development, and in production
 * only when SEED_DEMO=true. Credentials are env-overridable — set a real
 * SEED_DEMO_PASSWORD in production; do not rely on the default.
 */
async function seedDemo(store: InMemoryUserStore): Promise<void> {
  const enabled = !config.isProd || config.SEED_DEMO === 'true';
  if (!enabled) return;

  const passwordHash = await bcrypt.hash(config.SEED_DEMO_PASSWORD, 12);

  await store.create({
    email: config.SEED_DEMO_EMAIL,
    relationshipId: config.SEED_DEMO_RELATIONSHIP,
    brand: 'easdial',
    role: 'carrier',
    passwordHash,
    status: 'active',
  });
  await store.create({
    email: 'admin@easdial.com',
    relationshipId: 'REL-ADMIN',
    brand: 'easdial',
    role: 'admin',
    passwordHash,
    status: 'active',
  });

  logger.info(`Seeded login: ${config.SEED_DEMO_EMAIL} (carrier) + admin@easdial.com (admin)`);
  if (config.isProd && config.SEED_DEMO_PASSWORD === 'EasDialDemo!2026') {
    logger.warn('SEED_DEMO is using the DEFAULT password in production — set SEED_DEMO_PASSWORD.');
  }
}

async function main(): Promise<void> {
  const store = new InMemoryUserStore();
  await seedDemo(store);

  const { app } = await buildServer(store);
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(`EasDial portal API listening on :${config.PORT} (source=${config.PEEREDGE_SOURCE})`);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
