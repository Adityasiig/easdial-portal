import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { buildServer } from './server.js';
import { InMemoryUserStore } from './services/userStore.js';

/** Seed demo accounts in non-production so the portal is usable immediately. */
async function seedDemo(store: InMemoryUserStore): Promise<void> {
  if (config.isProd) return;
  const password = await bcrypt.hash('EasDialDemo!2026', 12);

  await store.create({
    email: 'carrier@easdial.com',
    relationshipId: 'REL-1001',
    brand: 'easdial',
    role: 'carrier',
    passwordHash: password,
    status: 'active',
  });
  await store.create({
    email: 'admin@easdial.com',
    relationshipId: 'REL-ADMIN',
    brand: 'easdial',
    role: 'admin',
    passwordHash: password,
    status: 'active',
  });

  logger.info('Seeded demo users (dev only):');
  logger.info('  carrier@easdial.com / EasDialDemo!2026  (relationship REL-1001)');
  logger.info('  admin@easdial.com   / EasDialDemo!2026  (admin)');
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
