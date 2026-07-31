import type { FastifyInstance, FastifyRequest } from 'fastify';
import { metricsQuerySchema } from '../schemas/auth.js';
import type { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { getSwitchClient } from '../adapters/peeredge/index.js';
import { BadRequest } from '../lib/errors.js';

export async function metricsRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.addHook('preHandler', requireAuth(authService));

  /** The relationship this request may read: the user's own, or (for an admin) a previewed one. */
  function scope(req: FastifyRequest): {
    relationshipId: string;
    direction: 'termination' | 'origination';
    metric: 'minutes' | 'attempts';
    role: 'customer' | 'vendor';
  } {
    const q = metricsQuerySchema.parse(req.query);
    const account = req.account!;
    const relationshipId =
      account.relationshipId ?? (account.role === 'admin' ? q.relationshipId : undefined);
    if (!relationshipId) throw BadRequest('No relationship is allocated to this account', 'no_relationship');
    return { relationshipId, direction: q.direction, metric: q.metric, role: q.role };
  }

  // What relationship the logged-in user is bound to (for the header/label).
  app.get('/metrics/context', async (req) => ({
    role: req.account!.role,
    relationshipId: req.account!.relationshipId,
    relationshipName: req.account!.relationshipName,
  }));

  app.get('/metrics/summary', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getSummary(relationshipId);
  });

  app.get('/metrics/overview', async (req) => {
    const { relationshipId, direction, metric } = scope(req);
    return getSwitchClient().getOverview(relationshipId, { direction, metric });
  });

  // Reportings → Relationship Performance
  app.get('/metrics/relationship-performance', async (req) => {
    const { relationshipId, direction, role } = scope(req);
    return getSwitchClient().getRelPerformance(relationshipId, direction, role);
  });

  // Reportings → Numbering
  app.get('/metrics/numbering', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getNumbering(relationshipId);
  });

  // Call Diagnostic
  app.get('/metrics/cdrs', async (req) => {
    const { relationshipId, direction } = scope(req);
    return getSwitchClient().getCdrs(relationshipId, direction);
  });

  // Accounting
  app.get('/metrics/rates', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getRates(relationshipId);
  });

  app.get('/metrics/invoices', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getInvoices(relationshipId);
  });

  app.get('/metrics/transactions', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getTransactions(relationshipId);
  });

  app.get('/metrics/payments', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getPayments(relationshipId);
  });
}
