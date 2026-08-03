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
  RateDeckDownload,
  RateRow,
  RelationshipRef,
  RelPerformanceRow,
  TransactionRow,
} from './types.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { PeeredgeSession } from './PeeredgeSession.js';
import { relationshipStartsWithBrandPrefix } from './relationshipFilter.js';
import { buildCdrColumns } from './cdrQuery.js';
import { scopedTrunkGroups } from './trunkGroupFilter.js';
import { fetchRateDeckFile } from './rateDeckDownload.js';

type JsonRecord = Record<string, unknown>;

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const stringValue = (value: unknown): string => value == null ? '' : String(value);
const records = (value: unknown): JsonRecord[] => Array.isArray(value)
  ? value.filter((item): item is JsonRecord => !!item && typeof item === 'object')
  : value && typeof value === 'object' && Array.isArray((value as JsonRecord).data)
    ? ((value as JsonRecord).data as unknown[]).filter((item): item is JsonRecord => !!item && typeof item === 'object')
    : [];

/**
 * Reads the DialPhone switch via ONE admin service login (api-<slug>/api/v2).
 *
 * Verified against the live DialPhone switch admin API:
 *   - POST /api/v2/login → bearer token (via PeeredgeSession)
 *   - GET  /api/v2/carriers → full carrier list (used to list ED- relationships)
 *   - relationship performance, scoped trunk groups, CDR search, rates, invoices,
 *     payments and dashboard graphs are always filtered to the allocated carrier.
 */
export class AdminRestClient implements SwitchDataClient {
  private readonly base: string;
  private carriers: JsonRecord[] | null = null;

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
    const carriers = await this.getCarriers();
    return carriers
      .filter((carrier) => relationshipStartsWithBrandPrefix(stringValue(carrier.carrier_name), this.brandPrefix))
      .map((carrier) => ({ id: stringValue(carrier.id), name: stringValue(carrier.carrier_name).trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSummary(relationshipId: string): Promise<DashboardSummary> {
    const carrier = await this.getCarrier(relationshipId);
    const performance = await this.getPerformanceRows(relationshipId, 'termination', 'customer', 2);
    const row = performance.find((item) => this.rowCarrierId(item) === relationshipId) ?? {};
    return {
      date: new Date().toISOString().slice(0, 10),
      runningBalance: numberValue(carrier.present_balance ?? carrier.balance),
      dailyMinutes: numberValue(row.minutes),
      dailyAttempts: numberValue(row.attempts),
      dailyAsr: numberValue(row.asr),
      dailyAloc: row.aloc == null && row.raw_aloc == null ? null : numberValue(row.aloc ?? row.raw_aloc),
    };
  }

  async getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries> {
    const direction = query.direction;
    const groups = await this.getScopedTrunkGroups(relationshipId, direction);
    const payloads = await Promise.all(groups.map(async (group) => {
      const params = new URLSearchParams({
        traffic_type: query.metric ?? 'minutes',
        traffic_direction: direction === 'termination' ? 'T' : 'O',
        trunk_group_type: direction === 'termination' ? 'Termination' : 'Origination',
        relationship_type: 'Customer',
        trunk_group_id: group.id,
        duration: 'Today',
      });
      return await this.getJson<JsonRecord>(`/dashboard/graphs?${params}`);
    }));

    const seriesKeys: Array<{ key: string; label: string; offsetDays: number }> = [
      { key: 'today', label: 'Today', offsetDays: 0 },
      { key: 'yesterday', label: 'Yesterday', offsetDays: 1 },
      { key: 'lastWeek', label: 'Last week', offsetDays: 7 },
    ];
    const series = seriesKeys.map(({ key, label, offsetDays }) => {
      const sums = new Map<string, number>();
      for (const payload of payloads) {
        for (const point of records(payload[key])) {
          const rawTime = stringValue(point.time);
          if (!rawTime) continue;
          const comparable = this.toIso(rawTime, offsetDays);
          sums.set(comparable, (sums.get(comparable) ?? 0) + numberValue(point.value));
        }
      }
      return { label, points: [...sums].sort(([a], [b]) => a.localeCompare(b)).map(([ts, value]) => ({ ts, value })) };
    });
    return {
      direction,
      metric: query.metric ?? 'minutes',
      granularityMinutes: 15,
      series,
    };
  }

  async getRelPerformance(
    relationshipId: string,
    direction: Direction,
    role: PartyRole,
    startTime?: string,
    endTime?: string,
  ): Promise<RelPerformanceRow[]> {
    const rows = await this.getPerformanceRows(relationshipId, direction, role, 3, startTime, endTime);
    return rows.map((row) => ({
      name: stringValue(row.trunk_group_name ?? row.carrier_name ?? row.name),
      attempts: numberValue(row.attempts),
      completions: numberValue(row.completions),
      minutes: numberValue(row.minutes),
      asr: numberValue(row.asr),
      aloc: numberValue(row.aloc ?? row.raw_aloc),
      sdr: numberValue(row.sdr),
      mos: numberValue(row.mos),
    }));
  }

  async getNumbering(relationshipId: string): Promise<NumberingRow[]> {
    const payload = await this.getJson<unknown>(`/routeplan_numberings?page=1&per_page=1000&carrier_id=${encodeURIComponent(relationshipId)}`);
    return records(payload).map((row) => ({
      number: stringValue(row.number ?? row.did ?? row.prefix),
      type: stringValue(row.type ?? row.numbering_type),
      lastModified: stringValue(row.updated_at ?? row.modified_at),
      modifiedBy: stringValue(row.modified_by ?? row.modifier),
    }));
  }

  async getCdrFilters(relationshipId: string, direction: Direction, location?: string): Promise<CdrFilterOptions> {
    const [locations, customerTrunkGroups, vendorTrunkGroups] = await Promise.all([
      this.getLocations(),
      this.getScopedTrunkGroups(relationshipId, direction, location),
      this.getVendorTrunkGroups(direction, location),
    ]);
    return { locations, customerTrunkGroups, vendorTrunkGroups };
  }

  async getCdrs(relationshipId: string, query: CdrQuery): Promise<CdrRow[]> {
    const [customerGroups, vendorGroups] = await Promise.all([
      this.getScopedTrunkGroups(relationshipId, query.direction, query.location),
      query.vendorTrunkGroupId ? this.getVendorTrunkGroups(query.direction, query.location) : Promise.resolve([]),
    ]);
    const selectedCustomers = query.customerTrunkGroupId
      ? customerGroups.filter((group) => group.id === query.customerTrunkGroupId)
      : customerGroups;
    if (query.customerTrunkGroupId && selectedCustomers.length === 0) {
      throw new AppError(400, 'invalid_customer_trunk', 'Customer trunk is not allocated to this portal account');
    }
    if (selectedCustomers.length === 0) return [];
    const selectedVendor = query.vendorTrunkGroupId
      ? vendorGroups.find((group) => group.id === query.vendorTrunkGroupId)
      : undefined;
    if (query.vendorTrunkGroupId && !selectedVendor) {
      throw new AppError(400, 'invalid_vendor_trunk', 'Vendor trunk is not available for this traffic direction');
    }

    const payloads = await Promise.all(selectedCustomers.map((group) => {
      const columns = buildCdrColumns(query, group.id, selectedVendor?.id);
      return this.postJson<unknown>('/cdr_diagnostics/search', {
        call_type: query.status === 'completed' ? 'C' : query.status === 'failed' ? 'F' : 'A',
        start_time: query.startTime,
        end_time: query.endTime,
        duration_min: query.minDuration ?? null,
        duration_max: query.maxDuration ?? null,
        is_sanitize: false,
        location: query.location ?? 'dallas',
        columns,
      });
    }));

    const customerOnOriginationSide = query.direction === 'termination';
    const unique = new Map<string, CdrRow>();
    for (const payload of payloads) {
      for (const row of records(payload)) {
        const customerTrunk = `${stringValue(customerOnOriginationSide ? row.orig_carrier_name : row.term_carrier_name)} / ${stringValue(customerOnOriginationSide ? row.orig_trunk_group_name : row.term_trunk_group_name)}`;
        const vendorTrunk = `${stringValue(customerOnOriginationSide ? row.term_carrier_name : row.orig_carrier_name)} / ${stringValue(customerOnOriginationSide ? row.term_trunk_group_name : row.orig_trunk_group_name)}`;
        const mapped: CdrRow = {
          dateTime: this.toIso(row.call_transaction_time),
          ani: stringValue(row.from_did),
          dnis: stringValue(row.to_did),
          lrn: stringValue(row.lrn_did),
          releaseCode: stringValue(row.sip_code),
          releaseCause: stringValue(row.reason ?? row.sip_reason),
          duration: numberValue(row.duration_real),
          customerTrunk,
          vendorTrunk,
          relationshipTrunk: customerTrunk,
          origJuris: stringValue(row.orig_juris),
          rate: numberValue(customerOnOriginationSide ? row.orig_rate : row.term_rate),
        };
        const key = stringValue(row.cdr_uuid ?? row.callid) || `${mapped.dateTime}-${mapped.ani}-${mapped.dnis}`;
        unique.set(key, mapped);
      }
    }
    return [...unique.values()].sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  }

  async getLiveCalls(relationshipId: string): Promise<LiveCallRow[]> {
    // The admin endpoint is switch-wide and requires a location. Filter both
    // legs by the allocated relationship before anything leaves the backend.
    const carrier = await this.getCarrier(relationshipId);
    const carrierName = stringValue(carrier.carrier_name).trim().toLowerCase();
    const locations = await this.getLocations();
    const payloads = await Promise.all(locations.map(async (location) => {
      try { return await this.getJson<unknown>(`/live_calls?location=${encodeURIComponent(location)}`); }
      catch { return []; }
    }));
    return payloads.flatMap(records).filter((row) => {
      const names = [row.orig_carrier_name, row.term_carrier_name, row.originating_carrier_name, row.terminating_carrier_name]
        .map((value) => stringValue(value).trim().toLowerCase());
      return names.includes(carrierName);
    }).map((row) => ({
      relationship: stringValue(row.orig_carrier_name ?? row.originating_carrier_name ?? row.relationship_name),
      trunkGroup: stringValue(row.orig_trunk_group_name ?? row.originating_trunk_group_name ?? row.trunk_group_name),
      start: this.toIso(row.start_time ?? row.call_start_time ?? row.started_at),
      ani: stringValue(row.ani ?? row.from_did),
      dnis: stringValue(row.dnis ?? row.to_did),
      duration: numberValue(row.duration ?? row.duration_real),
    }));
  }

  async getCdrExports(_relationshipId: string): Promise<CdrExportRow[]> {
    // Admin exports are generated asynchronously and the list route is not
    // carrier-scoped. Do not expose switch-wide export history to customers.
    return [];
  }

  async getRates(relationshipId: string): Promise<RateRow[]> {
    const payload = await this.getJson<unknown>(`/rate_sheets?carrier_id=${encodeURIComponent(relationshipId)}`);
    return records(payload).map((row) => ({
      id: stringValue(row.id ?? row.rate_sheet_id),
      name: stringValue(row.name),
      trunkGroups: Array.isArray(row.trunk_groups) ? row.trunk_groups.length : numberValue(row.trunk_groups),
      direction: stringValue(row.direction),
      relationship: stringValue(row.relationship_type),
      location: stringValue(row.location),
      type: stringValue(row.deck_type ?? row.rate_by),
      totalRates: numberValue(row.total_count),
      expirationDate: row.expiration_date ? stringValue(row.expiration_date) : null,
      modified: stringValue(row.updated_at ?? row.created_at),
    }));
  }

  async downloadRateDeck(relationshipId: string, rateSheetId: string): Promise<RateDeckDownload> {
    const rate = (await this.getRates(relationshipId)).find((row) => row.id === rateSheetId);
    if (!rate) throw new AppError(404, 'rate_deck_not_found', 'Rate deck not found for this relationship');
    const payload = await this.getJson<{ url?: unknown; data?: { url?: unknown } }>(`/rate_sheets/download_rates?rate_sheet_id=${encodeURIComponent(rateSheetId)}`);
    const rawUrl = stringValue(payload.url ?? payload.data?.url);
    if (!rawUrl) throw new AppError(502, 'peeredge_rate_download', 'Peeredge returned no rate download URL');
    const url = new URL(rawUrl, this.base).toString();
    const sameOrigin = new URL(url).origin === new URL(this.base).origin;
    const headers = sameOrigin ? await this.session.requestHeaders() : {};
    return fetchRateDeckFile(url, `${rate.name}.csv`, headers);
  }

  async getInvoices(relationshipId: string): Promise<InvoiceRow[]> {
    const payload = await this.getJson<unknown>(`/invoices?carrier_id=${encodeURIComponent(relationshipId)}`);
    return records(payload).map((row) => ({
      invoiceNumber: stringValue(row.invoice_number ?? row.number ?? row.id),
      validity: row.is_incorrect ? 'Incorrect' : 'Valid',
      createdAt: stringValue(row.created_at),
      startEndDate: `${stringValue(row.start_date)} — ${stringValue(row.end_date)}`,
      invoiceCycle: stringValue(row.invoice_cycle),
      invoiceAmount: numberValue(row.total_amount ?? row.invoice_amount ?? row.amount),
      tag: stringValue(row.tag ?? row.status),
    }));
  }

  async getTransactions(relationshipId: string): Promise<TransactionRow[]> {
    const payload = await this.getJson<unknown>(`/carrier_payments?carrier_id=${encodeURIComponent(relationshipId)}`);
    return records(payload).map((row) => ({
      date: stringValue(row.created_at ?? row.date),
      transaction: stringValue(row.transaction ?? row.traffic_type),
      type: stringValue(row.transaction_type ?? row.type),
      transactionDate: stringValue(row.transaction_date),
      amount: numberValue(row.amount),
      runningBalance: numberValue(row.running_balance),
      paymentMemo: stringValue(row.payment_memo ?? row.memo),
      addedFrom: stringValue(row.added_from),
    }));
  }

  async getPayments(_relationshipId: string): Promise<PaymentRow[]> {
    // The switch-admin payment-registration route is not carrier scoped. Keep
    // it closed instead of risking cross-customer financial data disclosure.
    return [];
  }

  private async getCarriers(): Promise<JsonRecord[]> {
    if (!this.carriers) this.carriers = records(await this.getJson<unknown>('/carriers'));
    return this.carriers;
  }

  private async getCarrier(relationshipId: string): Promise<JsonRecord> {
    const carrier = (await this.getCarriers()).find((row) => stringValue(row.id) === relationshipId);
    if (!carrier) throw new AppError(404, 'relationship_not_found', 'Relationship not found in Peeredge');
    return carrier;
  }

  private rowCarrierId(row: JsonRecord): string {
    return stringValue(
      row.carrier_id_customer
      ?? row.customer_carrier_id
      ?? row.relationship_id
      ?? row.carrier_id
      ?? row.id,
    );
  }

  private todayBounds(): { start: string; end: string } {
    const date = new Date().toISOString().slice(0, 10);
    return { start: `${date}T00:00:00Z`, end: `${date}T23:59:59Z` };
  }

  private async getPerformanceRows(
    relationshipId: string,
    direction: Direction,
    role: PartyRole,
    level: 2 | 3,
    startTime?: string,
    endTime?: string,
  ): Promise<JsonRecord[]> {
    const today = this.todayBounds();
    const start = startTime ?? today.start;
    const end = endTime ?? today.end;
    const params = new URLSearchParams({
      relationship_type: role === 'customer' ? 'C' : 'V',
      traffic_direction: direction === 'termination' ? 'T' : 'O',
      start_datetime: start,
      end_datetime: end,
    });
    if (level === 3) params.set('carrier_id', relationshipId);
    const rows = records(await this.getJson<unknown>(`/relationship_performance/level${level}?${params}`));
    return level === 2 ? rows.filter((row) => this.rowCarrierId(row) === relationshipId) : rows;
  }

  private async getLocations(): Promise<string[]> {
    const rows = records(await this.getJson<unknown>('/locations/server_locations'));
    return [...new Set(rows.map((row) => stringValue(row.location ?? row.name)).filter(Boolean))].sort();
  }

  private async getScopedTrunkGroups(
    relationshipId: string,
    direction: Direction,
    location?: string,
  ): Promise<Array<{ id: string; label: string }>> {
    const carrier = await this.getCarrier(relationshipId);
    const carrierName = stringValue(carrier.carrier_name).trim();
    const trunkGroupType = direction === 'termination' ? '0' : '1';
    const locations = location ? [location] : await this.getLocations();
    const payloads = await Promise.all((locations.length ? locations : ['']).map((location) => {
      const params = new URLSearchParams({
        trunk_group_type: trunkGroupType,
        relationship_type: '1',
        carrier_id: relationshipId,
      });
      if (location) params.set('location', location);
      return this.getJson<unknown>(`/trunk_groups/by_type_and_location?${params}`);
    }));
    return scopedTrunkGroups(payloads.flatMap(records), relationshipId, carrierName);
  }

  private async getVendorTrunkGroups(direction: Direction, location?: string): Promise<Array<{ id: string; label: string }>> {
    const trunkGroupType = direction === 'termination' ? '0' : '1';
    const locations = location ? [location] : await this.getLocations();
    const payloads = await Promise.all((locations.length ? locations : ['']).map((location) => {
      const params = new URLSearchParams({ trunk_group_type: trunkGroupType, relationship_type: '0' });
      if (location) params.set('location', location);
      return this.getJson<unknown>(`/trunk_groups/by_type_and_location?${params}`);
    }));
    const groups = payloads.flatMap(records).map((row) => ({
      id: stringValue(row.id ?? row.trunk_group_id),
      label: stringValue(row.complete_name ?? row.carrier_name ?? row.trunk_group_name ?? row.name),
    })).filter((group) => group.id && group.label);
    return [...new Map(groups.map((group) => [group.id, group])).values()]
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private toIso(value: unknown, shiftDays = 0): string {
    const raw = stringValue(value);
    if (!raw) return '';
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);
    if (Number.isNaN(parsed.getTime())) return raw;
    if (shiftDays) parsed.setUTCDate(parsed.getUTCDate() + shiftDays);
    return parsed.toISOString();
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

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const send = async () => fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: await this.session.requestHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    let res = await send();
    if (res.status === 401 || res.status === 403) {
      await this.session.refresh();
      res = await send();
    }
    if (!res.ok) {
      logger.warn({ path, status: res.status }, 'Peeredge admin request failed');
      throw new AppError(502, 'peeredge_upstream', `${path} returned ${res.status}`);
    }
    return await res.json() as T;
  }
}
