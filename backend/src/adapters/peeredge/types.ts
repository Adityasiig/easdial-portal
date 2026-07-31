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

/** One row of the termination/origination performance report (per trunk group / destination). */
export interface PerformanceRow {
  name: string;
  attempts: number;
  asr: number; // answer-seizure ratio, %
  acd: number; // average call duration
  minutes: number;
  pdd: number; // post-dial delay, ms
  cost: number;
  revenue: number;
  margin: number;
}
