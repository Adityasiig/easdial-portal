import type { DashboardSummary, Identity, OverviewSeries, MetricsQuery } from './types.js';

/**
 * The single seam between our app and Peeredge. One instance per authenticated
 * user; the instance carries that user's session, so all reads are naturally
 * scoped to their own relationship (Dependency Inversion).
 */
export interface PeeredgeClient {
  /** Verify auth and return the logged-in user's identity (Peeredge `/me`). */
  whoami(): Promise<Identity>;

  /** Headline KPI tiles for the current reporting day. */
  getDashboardSummary(): Promise<DashboardSummary>;

  /** Time-series for the overview chart (Today / Yesterday / Last week). */
  getOverviewSeries(query: MetricsQuery): Promise<OverviewSeries>;

  /** Cheap liveness probe for the upstream data source. */
  healthy(): Promise<boolean>;
}
