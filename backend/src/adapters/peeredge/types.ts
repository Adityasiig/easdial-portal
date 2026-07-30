/** Domain types for the admin-aggregation model. */

export type Direction = 'termination' | 'origination';

/** A relationship the admin can allocate to a user (ED- filtered). */
export interface RelationshipRef {
  id: string;
  name: string;
}

/** Headline KPI tiles for one relationship's current reporting day. */
export interface DashboardSummary {
  date: string;
  dailyMinutes: number;
  dailyAttempts: number;
  dailyAttemptsTarget: number;
  dailyPrv: number;
  dailyPrvTarget: number;
  activePorts: number;
}

export interface SeriesPoint {
  ts: string;
  value: number;
}

export interface NamedSeries {
  label: 'Today' | 'Yesterday' | 'Last week';
  points: SeriesPoint[];
}

export interface OverviewSeries {
  direction: Direction;
  metric: 'minutes' | 'attempts';
  granularityMinutes: number;
  series: NamedSeries[];
}

export interface MetricsQuery {
  direction: Direction;
  metric?: 'minutes' | 'attempts';
}
