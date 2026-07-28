import { getPeeredgeClient } from '../adapters/peeredge/index.js';
import type { DashboardSummary, Direction, OverviewSeries } from '../adapters/peeredge/types.js';

/**
 * Thin domain service over the Peeredge adapter. Enforces tenant scoping:
 * callers pass the relationshipId taken from the authenticated JWT, never from
 * user-supplied input, so a carrier can only read their own data.
 */
export class MetricsService {
  private client = getPeeredgeClient();

  getSummary(relationshipId: string): Promise<DashboardSummary> {
    return this.client.getDashboardSummary(relationshipId);
  }

  getOverview(
    relationshipId: string,
    direction: Direction,
    metric: 'minutes' | 'attempts' = 'minutes',
  ): Promise<OverviewSeries> {
    return this.client.getOverviewSeries({ relationshipId, direction, metric });
  }

  upstreamHealthy(): Promise<boolean> {
    return this.client.healthy();
  }
}

export const metricsService = new MetricsService();
