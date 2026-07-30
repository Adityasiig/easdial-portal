import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));
  app.get('/health/upstream', async () => ({ source: config.PEEREDGE_SOURCE }));
}
