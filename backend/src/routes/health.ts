import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  // Reports the configured data source; per-user upstream health is checked at login.
  app.get('/health/upstream', async () => ({ source: config.PEEREDGE_SOURCE }));
}
