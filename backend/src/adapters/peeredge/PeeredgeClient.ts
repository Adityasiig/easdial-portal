import type { DashboardSummary, OverviewSeries, MetricsQuery } from './types.js';

/**
 * The single seam between our app and Peeredge.
 * Everything above this interface is source-agnostic (Dependency Inversion).
 * Implementations: MockPeeredgeClient (default), RestPeeredgeClient (live).
 */
export interface PeeredgeClient {
  /** Headline KPI tiles for a relationship's current reporting day. */
  getDashboardSummary(relationshipId: string): Promise<DashboardSummary>;

  /** Time-series for the overview chart (Today / Yesterday / Last week). */
  getOverviewSeries(query: MetricsQuery): Promise<OverviewSeries>;

  /** Cheap liveness probe for the upstream data source. */
  healthy(): Promise<boolean>;
}
