/** Domain types for carrier reporting — mirrors the Peeredge dashboard metrics. */

export type Direction = 'termination' | 'origination';

/** Authenticated user identity, from Peeredge `/me`. */
export interface Identity {
  email: string;
  name: string;
  relationshipId: string;
}

/** Headline KPI tiles (Daily Minutes / Attempts / PRV). */
export interface DashboardSummary {
  /** Reporting day in UTC (YYYY-MM-DD). Peeredge reports in GMT. */
  date: string;
  dailyMinutes: number;
  dailyAttempts: number;
  dailyAttemptsTarget: number;
  dailyPrv: number;
  dailyPrvTarget: number;
  activePorts: number;
}

export interface SeriesPoint {
  /** Bucket start, ISO-8601 UTC. */
  ts: string;
  value: number;
}

/** One line on the overview chart (Today / Yesterday / Last week). */
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

/** A metrics request. Scoping is by the authenticated Peeredge session, not a param. */
export interface MetricsQuery {
  direction: Direction;
  metric?: 'minutes' | 'attempts';
}
