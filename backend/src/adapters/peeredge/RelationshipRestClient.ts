import type { SwitchDataClient } from './SwitchDataClient.js';
import type {
  CdrExportRow,
  CdrFilterOptions,
  CdrQuery,
  CdrRow,
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
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { PeeredgeSession } from './PeeredgeSession.js';

type JsonRecord = Record<string, unknown>;

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const stringValue = (value: unknown): string => (value == null ? '' : String(value));
const records = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.filter((item): item is JsonRecord => !!item && typeof item === 'object') : [];
const responseRecords = (value: unknown): JsonRecord[] => {
  if (Array.isArray(value)) return records(value);
  if (value && typeof value === 'object') return records((value as JsonRecord).data);
  return [];
};

/**
 * Verified single-carrier adapter for the Peeredge relationship API.
 * Credentials are supplied only through backend environment variables.
 */
export class RelationshipRestClient implements SwitchDataClient {
  private carrierId: string | null = null;

  constructor(
    private readonly base: string,
    private readonly session: PeeredgeSession,
    private readonly relationshipName: string,
  ) {}

  async healthy(): Promise<boolean> {
    try { await this.getJson('/me'); return true; } catch { return false; }
  }

  async listRelationships(): Promise<RelationshipRef[]> {
    return [{ id: await this.getCarrierId(), name: this.relationshipName }];
  }

  async getSummary(_relationshipId: string): Promise<DashboardSummary> {
    const response = await this.getJson<{ data?: JsonRecord[] | null; present_balance?: unknown }>('/dashboard/statistics');
    const data = response.data?.[0] ?? {};
    return {
      date: new Date().toISOString().slice(0, 10),
      runningBalance: numberValue(response.present_balance),
      dailyMinutes: numberValue(data.minutes),
      dailyAttempts: numberValue(data.attempts),
      dailyAsr: numberValue(data.asr),
      dailyAloc: data.aloc == null ? null : numberValue(data.aloc),
    };
  }

  async getOverview(_relationshipId: string, query: MetricsQuery): Promise<OverviewSeries> {
    const params = new URLSearchParams({
      traffic_type: query.metric ?? 'minutes',
      traffic_direction: query.direction === 'termination' ? 'T' : 'O',
      duration: 'Today',
    });
    const payload = await this.getJson<Array<Record<string, Array<{ time?: string; value?: unknown }>>>>(`/dashboard/graphs?${params}`);
    const series = payload.flatMap((group) => Object.entries(group).map(([label, points]) => ({
      label,
      points: (points ?? []).map((point) => ({ ts: this.toIso(point.time), value: numberValue(point.value) })),
    })));
    return { direction: query.direction, metric: query.metric ?? 'minutes', granularityMinutes: 15, series };
  }

  async getRelPerformance(_relationshipId: string, direction: Direction, role: PartyRole): Promise<RelPerformanceRow[]> {
    const { start, end } = this.todayBounds();
    const params = new URLSearchParams({ relationship_type: role === 'customer' ? 'C' : 'V', traffic_direction: direction === 'termination' ? 'T' : 'O', start_datetime: start, end_datetime: end });
    const payload = await this.getJson<unknown>(`/relationship_performance/level1?${params}`);
    return responseRecords(payload).map((row) => ({
      name: stringValue(row.relationship_name ?? row.relationship ?? row.name),
      attempts: numberValue(row.attempts), completions: numberValue(row.completions), minutes: numberValue(row.minutes),
      asr: numberValue(row.asr), aloc: numberValue(row.aloc), sdr: numberValue(row.sdr), mos: numberValue(row.mos),
    }));
  }

  async getNumbering(_relationshipId: string): Promise<NumberingRow[]> {
    const payload = await this.getJson<{ data?: JsonRecord[] | null }>('/routeplan_numberings?page=1&per_page=1000');
    return records(payload.data).map((row) => ({
      number: stringValue(row.number ?? row.did ?? row.prefix),
      type: stringValue(row.type ?? row.numbering_type),
      lastModified: stringValue(row.updated_at ?? row.modified_at),
      modifiedBy: stringValue(row.modified_by ?? row.modifier),
    }));
  }

  async getCdrFilters(_relationshipId: string, _direction: Direction): Promise<CdrFilterOptions> {
    const carrierId = await this.getCarrierId();
    const [locationPayload, trunkPayload] = await Promise.all([
      this.getJson<unknown>('/locations/server_locations'),
      this.getJson<unknown>(`/trunk_groups/complete_names?trunk_group_type=0&carrier_id=${encodeURIComponent(carrierId)}`),
    ]);
    return {
      locations: this.normalizeLocations(locationPayload),
      trunkGroups: this.normalizeTrunkGroups(trunkPayload),
    };
  }

  async getCdrs(_relationshipId: string, query: CdrQuery): Promise<CdrRow[]> {
    const typeColumns = query.direction === 'termination'
      ? [{ name: 'orig_trunk_group_type', value: '1' }, { name: 'term_trunk_group_type', value: '2' }]
      : [{ name: 'orig_trunk_group_type', value: '2' }, { name: 'term_trunk_group_type', value: '1' }];
    const columns: Array<{ name: string; value: string }> = [...typeColumns];
    let selectedColumn: 'orig_trunk_group_id' | 'term_trunk_group_id' | null = null;
    if (query.trunkGroupId) {
      const customerGroup = query.trunkGroupLabel?.toLowerCase().includes('customer') ?? false;
      selectedColumn = query.direction === 'termination'
        ? (customerGroup ? 'orig_trunk_group_id' : 'term_trunk_group_id')
        : (customerGroup ? 'term_trunk_group_id' : 'orig_trunk_group_id');
      columns.unshift({ name: selectedColumn, value: query.trunkGroupId });
    }
    if (query.ani) columns.push({ name: 'from_did', value: query.ani });
    if (query.dnis) columns.push({ name: 'to_did', value: query.dnis });

    const payload = await this.postJson<unknown>('/cdr_diagnostics/search', {
      call_type: query.status === 'completed' ? 'C' : query.status === 'failed' ? 'F' : 'A',
      start_time: query.startTime,
      end_time: query.endTime,
      location: query.location ?? 'dallas',
      columns,
    });
    const useOriginationSide = selectedColumn
      ? selectedColumn === 'orig_trunk_group_id'
      : query.direction === 'termination';
    const rows = responseRecords(payload).map((row) => ({
        dateTime: this.toIso(row.call_transaction_time), ani: stringValue(row.from_did), dnis: stringValue(row.to_did),
        lrn: stringValue(row.lrn_did), releaseCode: stringValue(row.sip_code), releaseCause: stringValue(row.reason ?? row.sip_reason),
        duration: numberValue(row.duration_real),
        relationshipTrunk: `${stringValue(useOriginationSide ? row.orig_carrier_name : row.term_carrier_name)} / ${stringValue(useOriginationSide ? row.orig_trunk_group_name : row.term_trunk_group_name)}`,
        origJuris: stringValue(row.orig_juris), rate: numberValue(useOriginationSide ? row.orig_rate : row.term_rate),
      }));
    const start = new Date(query.startTime).getTime();
    const end = new Date(query.endTime).getTime();
    const ani = query.ani?.toLowerCase();
    const dnis = query.dnis?.toLowerCase();
    return rows.filter((row) => {
      const timestamp = new Date(row.dateTime).getTime();
      if (Number.isFinite(timestamp) && (timestamp < start || timestamp > end)) return false;
      if (query.status === 'completed' && row.duration === 0) return false;
      if (query.status === 'failed' && row.duration > 0) return false;
      if (ani && !row.ani.toLowerCase().includes(ani)) return false;
      if (dnis && !row.dnis.toLowerCase().includes(dnis)) return false;
      return true;
    });
  }

  async getLiveCalls(_relationshipId: string): Promise<LiveCallRow[]> {
    const payload = await this.getJson<unknown>('/live_calls');
    return responseRecords(payload).map((row) => ({
      relationship: stringValue(row.relationship_name ?? row.carrier_name ?? row.relationship),
      trunkGroup: stringValue(row.trunk_group_name ?? row.trunk_group),
      start: this.toIso(row.start_time ?? row.started_at ?? row.call_transaction_time),
      ani: stringValue(row.ani ?? row.from_did),
      dnis: stringValue(row.dnis ?? row.to_did),
      duration: numberValue(row.duration ?? row.duration_real),
    }));
  }

  async getCdrExports(_relationshipId: string): Promise<CdrExportRow[]> {
    const carrierId = await this.getCarrierId();
    const payload = await this.getJson<unknown>(`/cdr_diagnostics/export_list?carrier_id=${encodeURIComponent(carrierId)}`);
    return responseRecords(payload).map((row) => ({
      exportName: stringValue(row.export_name ?? row.name), exportDate: stringValue(row.created_at), status: stringValue(row.status),
      period: `${stringValue(row.start_date)} — ${stringValue(row.end_date)}`, exportUser: stringValue(row.export_user ?? row.user_name),
    }));
  }

  async getRates(_relationshipId: string): Promise<RateRow[]> {
    const payload = await this.getJson<unknown>('/rate_sheets');
    return responseRecords(payload).map((row) => ({
      name: stringValue(row.name), trunkGroups: Array.isArray(row.trunk_groups) ? row.trunk_groups.length : numberValue(row.trunk_groups),
      direction: stringValue(row.direction), relationship: stringValue(row.relationship_type), location: stringValue(row.location),
      type: stringValue(row.deck_type ?? row.rate_by), totalRates: numberValue(row.total_count), expirationDate: row.expiration_date ? stringValue(row.expiration_date) : null,
      modified: stringValue(row.updated_at ?? row.created_at),
    }));
  }

  async getInvoices(_relationshipId: string): Promise<InvoiceRow[]> {
    const payload = await this.getJson<unknown>('/invoices');
    return responseRecords(payload).map((row) => ({
      invoiceNumber: stringValue(row.invoice_number ?? row.number), validity: stringValue(row.validity ?? row.is_incorrect),
      createdAt: stringValue(row.created_at), startEndDate: `${stringValue(row.start_date)} — ${stringValue(row.end_date)}`,
      invoiceCycle: stringValue(row.invoice_cycle), invoiceAmount: numberValue(row.invoice_amount ?? row.amount), tag: stringValue(row.tag ?? row.status),
    }));
  }

  async getTransactions(_relationshipId: string): Promise<TransactionRow[]> {
    const carrierId = await this.getCarrierId();
    const payload = await this.getJson<unknown>(`/carrier_payments?carrier_id=${encodeURIComponent(carrierId)}`);
    return responseRecords(payload).map((row) => ({
      date: stringValue(row.created_at ?? row.date), transaction: stringValue(row.transaction), type: stringValue(row.transaction_type ?? row.type),
      transactionDate: stringValue(row.transaction_date), amount: numberValue(row.amount), runningBalance: numberValue(row.running_balance),
      paymentMemo: stringValue(row.payment_memo ?? row.memo), addedFrom: stringValue(row.added_from),
    }));
  }

  async getPayments(_relationshipId: string): Promise<PaymentRow[]> {
    const payload = await this.getJson<unknown>('/paypal_registrations');
    return responseRecords(payload).map((row) => ({
      carrierName: stringValue(row.carrier_name), description: stringValue(row.description), invoiceId: stringValue(row.invoice_id ?? row.transaction_id),
      totalAmount: numberValue(row.total_amount ?? row.amount), paidTo: stringValue(row.paid_to), paypalFee: numberValue(row.paypal_fee),
      purchasedAt: stringValue(row.purchased_at ?? row.created_at), reason: stringValue(row.reason), status: stringValue(row.status),
    }));
  }

  private normalizeLocations(payload: unknown): string[] {
    const source = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as JsonRecord).data)
        ? (payload as JsonRecord).data as unknown[]
        : [];
    const values = source.map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const row = item as JsonRecord;
      return stringValue(row.location ?? row.server_location ?? row.name ?? row.value);
    }).filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }

  private normalizeTrunkGroups(payload: unknown): Array<{ id: string; label: string }> {
    const source = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as JsonRecord).data)
        ? (payload as JsonRecord).data as unknown[]
        : [payload];
    const groups: Array<{ id: string; label: string }> = [];
    for (const item of source) {
      if (!item || typeof item !== 'object') continue;
      const row = item as JsonRecord;
      const id = stringValue(row.id ?? row.trunk_group_id ?? row.value);
      const label = stringValue(row.complete_name ?? row.trunk_group_name ?? row.name ?? row.label);
      if (id && label) {
        groups.push({ id, label });
        continue;
      }
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' || typeof value === 'number') groups.push({ id: key, label: String(value) });
      }
    }
    return [...new Map(groups.filter((group) => group.id && group.label).map((group) => [group.id, group])).values()]
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private async getCarrierId(): Promise<string> {
    if (this.carrierId) return this.carrierId;
    const response = await this.getJson<{ user?: { carrier_id?: unknown } }>('/me');
    this.carrierId = stringValue(response.user?.carrier_id);
    if (!this.carrierId) throw new AppError(502, 'peeredge_missing_carrier', 'Peeredge session returned no carrier id');
    return this.carrierId;
  }

  private todayBounds(): { start: string; end: string } {
    const date = new Date().toISOString().slice(0, 10);
    return { start: `${date}T00:00:00Z`, end: `${date}T23:59:59Z` };
  }

  private toIso(value: unknown): string {
    const raw = stringValue(value);
    if (!raw) return '';
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }

  private async get(path: string): Promise<Response> {
    const request = async () => fetch(`${this.base}${path}`, { headers: await this.session.requestHeaders() });
    let response = await request();
    if (response.status === 401 || response.status === 403) {
      await this.session.refresh();
      response = await request();
    }
    return response;
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.get(path);
    if (!response.ok) throw new AppError(502, 'peeredge_upstream', `${path} returned ${response.status}`);
    return await response.json() as T;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const send = async () => fetch(`${this.base}${path}`, {
      method: 'POST', headers: await this.session.requestHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body),
    });
    let response = await send();
    if (response.status === 401 || response.status === 403) { await this.session.refresh(); response = await send(); }
    if (!response.ok) {
      logger.warn({ path, status: response.status }, 'Peeredge relationship request failed');
      throw new AppError(502, 'peeredge_upstream', `${path} returned ${response.status}`);
    }
    return await response.json() as T;
  }
}
