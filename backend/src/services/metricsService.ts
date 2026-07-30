import type { PeeredgeClient } from '../adapters/peeredge/index.js';
import type { DashboardSummary, Direction, OverviewSeries } from '../adapters/peeredge/types.js';

/**
 * Stateless helpers over an authenticated user's Peeredge client. Scoping is
 * intrinsic — the client carries that user's session — so there is no
 * relationship id to pass (and thus no way to read someone else's data).
 */
export const metrics = {
  summary(client: PeeredgeClient): Promise<DashboardSummary> {
    return client.getDashboardSummary();
  },
  overview(
    client: PeeredgeClient,
    direction: Direction,
    metric: 'minutes' | 'attempts',
  ): Promise<OverviewSeries> {
    return client.getOverviewSeries({ direction, metric });
  },
};
