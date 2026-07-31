import type {
  CdrRow,
  DashboardSummary,
  Direction,
  InvoiceRow,
  MetricsQuery,
  NumberingRow,
  OverviewSeries,
  PartyRole,
  PaymentRow,
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

  /** Overview time-series for one relationship. */
  getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries>;

  /** Reportings → Relationship Performance rows. */
  getRelPerformance(relationshipId: string, direction: Direction, role: PartyRole): Promise<RelPerformanceRow[]>;

  /** Reportings → Numbering rows. */
  getNumbering(relationshipId: string): Promise<NumberingRow[]>;

  /** Call Diagnostic CDR rows. */
  getCdrs(relationshipId: string, direction: Direction): Promise<CdrRow[]>;

  /** Accounting → View Rates rows. */
  getRates(relationshipId: string): Promise<RateRow[]>;

  /** Accounting → Invoices rows. */
  getInvoices(relationshipId: string): Promise<InvoiceRow[]>;

  /** Accounting → Carrier Payments transaction rows. */
  getTransactions(relationshipId: string): Promise<TransactionRow[]>;

  /** Accounting → Send Payment history rows. */
  getPayments(relationshipId: string): Promise<PaymentRow[]>;

  healthy(): Promise<boolean>;
}
