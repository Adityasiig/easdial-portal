/** Domain types for the admin-aggregation model (mirrors the Peeredge carrier portal). */

export type Direction = 'termination' | 'origination';
export type PartyRole = 'customer' | 'vendor';

/** A relationship the admin can allocate to a user (ED- filtered). */
export interface RelationshipRef {
  id: string;
  name: string;
}

/** Headline KPI tiles for one relationship's current reporting day. */
export interface DashboardSummary {
  date: string;
  runningBalance: number;
  dailyMinutes: number;
  dailyAttempts: number;
  dailyAsr: number; // %
  dailyAloc: number | null; // null renders as N/A
}

export interface SeriesPoint {
  ts: string;
  value: number;
}

export interface NamedSeries {
  label: string;
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

/** Reportings → Relationship Performance row. */
export interface RelPerformanceRow {
  name: string;
  attempts: number;
  completions: number;
  minutes: number;
  asr: number; // %
  aloc: number;
  sdr: number; // %
  mos: number;
}

/** Reportings → Numbering row. */
export interface NumberingRow {
  number: string;
  type: string;
  lastModified: string;
  modifiedBy: string;
}

/** Call Diagnostic CDR row. */
export interface CdrRow {
  dateTime: string;
  ani: string;
  dnis: string;
  lrn: string;
  releaseCode: string;
  releaseCause: string;
  duration: number; // seconds
  relationshipTrunk: string;
  origJuris: string;
  rate: number;
}

/** Accounting → View Rates row. */
export interface RateRow {
  name: string;
  trunkGroups: number;
  direction: string;
  relationship: string;
  location: string;
  type: string;
  totalRates: number;
  expirationDate: string | null;
  modified: string;
}

/** Accounting → Invoices row. */
export interface InvoiceRow {
  invoiceNumber: string;
  validity: string;
  createdAt: string;
  startEndDate: string;
  invoiceCycle: string;
  invoiceAmount: number;
  tag: string;
}

/** Accounting → Carrier Payments (transactions) row. */
export interface TransactionRow {
  date: string;
  transaction: string;
  type: string;
  transactionDate: string;
  amount: number;
  runningBalance: number;
  paymentMemo: string;
  addedFrom: string;
}

/** Accounting → Send Payment history row. */
export interface PaymentRow {
  carrierName: string;
  description: string;
  invoiceId: string;
  totalAmount: number;
  paidTo: string;
  paypalFee: number;
  purchasedAt: string;
  reason: string;
  status: string;
}
