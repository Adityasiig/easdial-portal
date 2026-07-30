import type { DashboardSummary, MetricsQuery, OverviewSeries, RelationshipRef } from './types.js';

/**
 * Reads the DialPhone switch on behalf of the whole portal, using ONE admin
 * service login. Everything is keyed by relationshipId, so the portal can scope
 * each user to their single allocated relationship.
 */
export interface SwitchDataClient {
  /** ED- relationships available to allocate (from /carriers). */
  listRelationships(): Promise<RelationshipRef[]>;

  /** KPI tiles for one relationship. */
  getSummary(relationshipId: string): Promise<DashboardSummary>;

  /** Overview time-series for one relationship. */
  getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries>;

  healthy(): Promise<boolean>;
}
