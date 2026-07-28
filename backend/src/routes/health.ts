import type { FastifyInstance } from 'fastify';
import { metricsService } from '../services/metricsService.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  app.get('/health/upstream', async () => ({
    peeredge: (await metricsService.upstreamHealthy()) ? 'ok' : 'down',
  }));
}
