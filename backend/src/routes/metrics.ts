import type { FastifyInstance } from 'fastify';
import { metricsQuerySchema } from '../schemas/auth.js';
import { metrics } from '../services/metricsService.js';
import type { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

export async function metricsRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  // Every metrics call runs on the caller's own Peeredge session.
  app.addHook('preHandler', requireAuth(authService));

  app.get('/metrics/summary', async (req) => metrics.summary(req.userSession!.client));

  app.get('/metrics/overview', async (req) => {
    const { direction, metric } = metricsQuerySchema.parse(req.query);
    return metrics.overview(req.userSession!.client, direction, metric);
  });
}
