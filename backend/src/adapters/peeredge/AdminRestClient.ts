import type { SwitchDataClient } from './SwitchDataClient.js';
import type {
  CdrFilterOptions,
  CdrQuery,
  CdrRow,
  CdrExportRow,
  DashboardSummary,
  Direction,
  InvoiceRow,
  LiveCallRow,
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
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { PeeredgeSession } from './PeeredgeSession.js';

/**
 * Reads the DialPhone switch via ONE admin service login (api-<slug>/api/v2).
 *
 * CONFIRMED (from captured admin traffic):
 *   - POST /api/v2/login → bearer token (via PeeredgeSession)
 *   - GET  /api/v2/carriers → full carrier list (used to list ED- relationships)
 *   - GET  /api/v2/dashboard/statistics|graphs → switch-WIDE aggregates
 *
 * PENDING (needs one confirm with live admin creds): the per-relationship-by-ID
 * metrics endpoints. Until confirmed, the per-relationship readers return empty
 * shapes in rest mode. The relationship LIST is already live.
 */
export class AdminRestClient implements SwitchDataClient {
  private readonly base: string;

  constructor(
    baseUrl: string,
    private readonly session: PeeredgeSession,
    private readonly brandPrefix: string,
  ) {
    this.base = `${baseUrl.replace(/\/$/, '')}/api/v2`;
  }

  async healthy(): Promise<boolean> {
    try {
      return (await this.get('/users/detail')).ok;
    } catch {
      return false;
    }
  }

  async listRelationships(): Promise<RelationshipRef[]> {
    const carriers = await this.getJson<Array<{ id: number; carrier_name?: string }>>('/carriers');
    const re = new RegExp(`^\\s*${this.brandPrefix}\\s*-`, 'i');
    return carriers
      .filter((c) => re.test(c.carrier_name ?? ''))
      .map((c) => ({ id: String(c.id), name: (c.carrier_name ?? '').trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSummary(relationshipId: string): Promise<DashboardSummary> {
    // TODO(confirm-with-creds): per-relationship statistics endpoint.
    this.pending('summary', relationshipId);
    return {
      date: new Date().toISOString().slice(0, 10),
      runningBalance: 0,
      dailyMinutes: 0,
      dailyAttempts: 0,
      dailyAsr: 0,
      dailyAloc: null,
    };
  }

  async getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries> {
    this.pending('overview', relationshipId);
    return {
      direction: query.direction,
      metric: query.metric ?? 'minutes',
      granularityMinutes: 15,
      series: [],
    };
  }

  async getRelPerformance(
    relationshipId: string,
    _direction: Direction,
    _role: PartyRole,
  ): Promise<RelPerformanceRow[]> {
    // TODO(confirm-with-creds): GET /relationship_performance/... filtered to this relationship.
    this.pending('relationship-performance', relationshipId);
    return [];
  }

  async getNumbering(relationshipId: string): Promise<NumberingRow[]> {
    this.pending('numbering', relationshipId);
    return [];
  }

  async getCdrFilters(relationshipId: string, _direction: Direction): Promise<CdrFilterOptions> {
    this.pending('cdr-filters', relationshipId);
    return { locations: [], trunkGroups: [] };
  }

  async getCdrs(relationshipId: string, _query: CdrQuery): Promise<CdrRow[]> {
    this.pending('cdrs', relationshipId);
    return [];
  }

  async getLiveCalls(relationshipId: string): Promise<LiveCallRow[]> {
    this.pending('live-calls', relationshipId);
    return [];
  }

  async getCdrExports(relationshipId: string): Promise<CdrExportRow[]> {
    this.pending('cdr-exports', relationshipId);
    return [];
  }

  async getRates(relationshipId: string): Promise<RateRow[]> {
    this.pending('rates', relationshipId);
    return [];
  }

  async getInvoices(relationshipId: string): Promise<InvoiceRow[]> {
    this.pending('invoices', relationshipId);
    return [];
  }

  async getTransactions(relationshipId: string): Promise<TransactionRow[]> {
    this.pending('transactions', relationshipId);
    return [];
  }

  async getPayments(relationshipId: string): Promise<PaymentRow[]> {
    this.pending('payments', relationshipId);
    return [];
  }

  private pending(what: string, relationshipId: string): void {
    logger.warn({ what, relationshipId }, 'per-relationship endpoint pending confirmation with live admin creds');
  }

  // --- HTTP with re-auth on 401 -----------------------------------------

  private async get(path: string): Promise<Response> {
    const url = `${this.base}${path}`;
    const doFetch = async () => fetch(url, { headers: await this.session.requestHeaders() });
    let res = await doFetch();
    if (res.status === 401 || res.status === 403) {
      await this.session.refresh();
      res = await doFetch();
    }
    return res;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.get(path);
    if (!res.ok) throw new AppError(502, 'peeredge_upstream', `${path} returned ${res.status}`);
    return (await res.json()) as T;
  }
}
