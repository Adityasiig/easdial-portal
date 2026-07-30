import { config } from './config.js';
import { logger } from './lib/logger.js';
import { buildServer } from './server.js';

async function main(): Promise<void> {
  const { app } = await buildServer();
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(
    `EasDial portal API on :${config.PORT} (source=${config.PEEREDGE_SOURCE}, auth=Peeredge pass-through)`,
  );
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
