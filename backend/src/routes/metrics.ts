import type { FastifyInstance } from 'fastify';
import { metricsQuerySchema } from '../schemas/auth.js';
import { metricsService } from '../services/metricsService.js';
import type { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { Unauthorized } from '../lib/errors.js';

export async function metricsRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  // All metrics endpoints are authenticated and scoped to the caller's relationship.
  app.addHook('preHandler', requireAuth(authService));

  app.get('/metrics/summary', async (req) => {
    const relationshipId = req.auth?.relationshipId;
    if (!relationshipId) throw Unauthorized();
    return metricsService.getSummary(relationshipId);
  });

  app.get('/metrics/overview', async (req) => {
    const relationshipId = req.auth?.relationshipId;
    if (!relationshipId) throw Unauthorized();
    const { direction, metric } = metricsQuerySchema.parse(req.query);
    return metricsService.getOverview(relationshipId, direction, metric);
  });
}
