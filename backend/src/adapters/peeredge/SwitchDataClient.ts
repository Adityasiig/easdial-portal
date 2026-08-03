import type {
  CdrFilterOptions,
  CdrQuery,
  CdrRow,
  CdrExportRow,
  DashboardSummary,
  HeaderStats,
  Direction,
  InvoiceRow,
  LiveCallRow,
  MetricsQuery,
  NumberingRow,
  OverviewSeries,
  PartyRole,
  PaymentRow,
  RateDeckDownload,
  RateRow,
  RelationshipRef,
  RelPerformanceRow,
  TransactionRow,
} from './types.js';

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

  /** Live call and CPS counters for one relationship. */
  getHeaderStats(relationshipId: string): Promise<HeaderStats>;

  /** Overview time-series for one relationship. */
  getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries>;

  /** Reportings → Relationship Performance rows. */
  getRelPerformance(relationshipId: string, direction: Direction, role: PartyRole, startTime?: string, endTime?: string): Promise<RelPerformanceRow[]>;

  /** Reportings → Numbering rows. */
  getNumbering(relationshipId: string): Promise<NumberingRow[]>;

  /** Call Diagnostic CDR rows. */
  getCdrFilters(relationshipId: string, direction: Direction, location?: string): Promise<CdrFilterOptions>;

  /** Filtered Call Diagnostic CDR rows. */
  getCdrs(relationshipId: string, query: CdrQuery): Promise<CdrRow[]>;

  /** Call Diagnostic → Live Calls rows. */
  getLiveCalls(relationshipId: string): Promise<LiveCallRow[]>;

  /** Call Diagnostic → generated CDR exports. */
  getCdrExports(relationshipId: string): Promise<CdrExportRow[]>;

  /** Accounting → View Rates rows. */
  getRates(relationshipId: string): Promise<RateRow[]>;

  /** Download one full rate deck after relationship ownership is verified. */
  downloadRateDeck(relationshipId: string, rateSheetId: string): Promise<RateDeckDownload>;

  /** Accounting → Invoices rows. */
  getInvoices(relationshipId: string): Promise<InvoiceRow[]>;

  /** Accounting → Carrier Payments transaction rows. */
  getTransactions(relationshipId: string): Promise<TransactionRow[]>;

  /** Accounting → Send Payment history rows. */
  getPayments(relationshipId: string): Promise<PaymentRow[]>;

  healthy(): Promise<boolean>;
}
