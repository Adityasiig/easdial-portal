import type { FastifyInstance, FastifyRequest } from 'fastify';
import { cdrQuerySchema, metricsQuerySchema } from '../schemas/auth.js';
import type { AuthService } from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { getSwitchClient } from '../adapters/peeredge/index.js';
import { BadRequest, NotFound } from '../lib/errors.js';

export async function metricsRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.addHook('preHandler', requireAuth(authService));

  const isCustomerRate = (relationship: string): boolean => ['customer', '1'].includes(relationship.trim().toLowerCase());

  /** The relationship this request may read: the user's own, or (for an admin) a previewed one. */
  function scope(req: FastifyRequest): {
    relationshipId: string;
    direction: 'termination' | 'origination';
    metric: 'minutes' | 'attempts' | 'ports' | 'favorite_ports' | 'cps' | 'profit';
    role: 'customer' | 'vendor';
    startTime?: string;
    endTime?: string;
    location?: string;
  } {
    const q = metricsQuerySchema.parse(req.query);
    const account = req.account!;
    const relationshipId =
      account.relationshipId ?? (account.role === 'admin' ? q.relationshipId : undefined);
    if (!relationshipId) throw BadRequest('No relationship is allocated to this account', 'no_relationship');
    return { relationshipId, direction: q.direction, metric: q.metric, role: q.role, startTime: q.startTime, endTime: q.endTime, location: q.location };
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
    const { relationshipId, direction, role, startTime, endTime } = scope(req);
    return getSwitchClient().getRelPerformance(relationshipId, direction, role, startTime, endTime);
  });

  // Reportings → Numbering
  app.get('/metrics/numbering', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getNumbering(relationshipId);
  });

  // Call Diagnostic
  app.get('/metrics/cdr-filters', async (req) => {
    const { relationshipId, direction, location } = scope(req);
    const filters = await getSwitchClient().getCdrFilters(relationshipId, direction, location);
    // Vendor routing is commercially sensitive. The customer-facing CDR API
    // only exposes trunk groups allocated to the signed-in relationship.
    return { ...filters, vendorTrunkGroups: [] };
  });

  app.get('/metrics/cdrs', async (req) => {
    const { relationshipId } = scope(req);
    const query = cdrQuerySchema.parse(req.query);
    const customerSafeQuery = {
      ...query,
      vendorTrunkGroupId: undefined,
      vendorTrunkGroupLabel: undefined,
    };
    const rows = await getSwitchClient().getCdrs(relationshipId, customerSafeQuery);
    return rows.map((row) => ({ ...row, vendorTrunk: '' }));
  });

  app.get('/metrics/live-calls', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getLiveCalls(relationshipId);
  });

  app.get('/metrics/cdr-exports', async (req) => {
    const { relationshipId } = scope(req);
    return getSwitchClient().getCdrExports(relationshipId);
  });

  // Accounting
  app.get('/metrics/rates', async (req) => {
    const { relationshipId } = scope(req);
    const rates = await getSwitchClient().getRates(relationshipId);
    return rates.filter((rate) => isCustomerRate(rate.relationship));
  });

  app.get('/metrics/rates/:rateSheetId/download', async (req, reply) => {
    const { relationshipId } = scope(req);
    const { rateSheetId } = req.params as { rateSheetId: string };
    const rates = (await getSwitchClient().getRates(relationshipId))
      .filter((rate) => isCustomerRate(rate.relationship));
    if (!rates.some((rate) => rate.id === rateSheetId)) {
      throw NotFound('Rate deck not found for this customer', 'rate_deck_not_found');
    }
    const download = await getSwitchClient().downloadRateDeck(relationshipId, rateSheetId);
    reply.header('Content-Type', download.contentType);
    reply.header('Content-Disposition', `attachment; filename="${download.filename}"`);
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(Buffer.from(download.bytes));
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
