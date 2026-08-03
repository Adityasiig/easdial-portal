/** Minimal typed API client. The token survives reloads for this browser tab. */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type Role = 'admin' | 'user';
export type Direction = 'termination' | 'origination';
export type PartyRole = 'customer' | 'vendor';
export type DashboardMetric = 'minutes' | 'attempts' | 'ports' | 'favorite_ports' | 'cps' | 'profit';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  relationshipId: string | null;
  relationshipName: string | null;
}

export interface RelationshipRef {
  id: string;
  name: string;
}

export interface DashboardSummary {
  date: string;
  runningBalance: number;
  dailyMinutes: number;
  dailyAttempts: number;
  dailyAsr: number;
  dailyAloc: number | null;
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
  metric: DashboardMetric;
  granularityMinutes: number;
  series: NamedSeries[];
}

export interface RelPerformanceRow {
  name: string;
  attempts: number;
  completions: number;
  minutes: number;
  asr: number;
  aloc: number;
  sdr: number;
  mos: number;
}

export interface NumberingRow {
  number: string;
  type: string;
  lastModified: string;
  modifiedBy: string;
}

export interface CdrRow {
  dateTime: string;
  ani: string;
  dnis: string;
  lrn: string;
  releaseCode: string;
  releaseCause: string;
  duration: number;
  customerTrunk: string;
  vendorTrunk: string;
  relationshipTrunk: string;
  origJuris: string;
  rate: number;
}

export interface HeaderStats {
  activeCalls: number;
  activeCps: number;
}

export type CdrStatus = 'all' | 'completed' | 'failed';

export interface CdrQuery {
  direction: Direction;
  startTime: string;
  endTime: string;
  location?: string;
  customerTrunkGroupId?: string;
  customerTrunkGroupLabel?: string;
  vendorTrunkGroupId?: string;
  vendorTrunkGroupLabel?: string;
  ani?: string;
  dnis?: string;
  releaseCode?: string;
  callId?: string;
  minDuration?: number;
  maxDuration?: number;
  includeBLeg?: boolean;
  status: CdrStatus;
}

export interface CdrFilterOptions {
  locations: string[];
  customerTrunkGroups: Array<{ id: string; label: string }>;
  vendorTrunkGroups: Array<{ id: string; label: string }>;
}

export interface LiveCallRow {
  relationship: string;
  trunkGroup: string;
  start: string;
  ani: string;
  dnis: string;
  duration: number;
}

export interface CdrExportRow {
  exportName: string;
  exportDate: string;
  status: string;
  period: string;
  exportUser: string;
}

export interface RateRow {
  id: string;
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

export interface InvoiceRow {
  invoiceNumber: string;
  validity: string;
  createdAt: string;
  startEndDate: string;
  invoiceCycle: string;
  invoiceAmount: number;
  tag: string;
}

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

export interface UpstreamHealth {
  source: 'mock' | 'rest' | 'relationship';
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_KEY = 'easdial.session.token';
let authToken: string | null = typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY);

export function hasStoredToken(): boolean {
  return Boolean(authToken);
}

export function setToken(token: string | null): void {
  authToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? 'Request failed');
  }
  return body as T;
}

async function download(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) setToken(null);
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? 'Download failed');
  }

  const disposition = res.headers.get('content-disposition') ?? '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
  let filename = quotedName ?? 'rates.csv';
  if (encodedName) {
    try {
      filename = decodeURIComponent(encodedName);
    } catch {
      filename = encodedName;
    }
  }

  return { blob: await res.blob(), filename };
}

export const api = {
  upstreamHealth: () => request<UpstreamHealth>('/health/upstream'),
  login: (email: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: SessionUser }>('/auth/me'),

  // metrics (scoped to the caller's allocated relationship)
  summary: () => request<DashboardSummary>('/metrics/summary'),
  headerStats: () => request<HeaderStats>('/metrics/header-stats'),
  overview: (direction: Direction, metric: DashboardMetric) =>
    request<OverviewSeries>(`/metrics/overview?direction=${direction}&metric=${metric}`),
  relPerformance: (direction: Direction, role: PartyRole, startTime?: string, endTime?: string) => {
    const params = new URLSearchParams({ direction, role });
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    return request<RelPerformanceRow[]>(`/metrics/relationship-performance?${params}`);
  },
  numbering: () => request<NumberingRow[]>('/metrics/numbering'),
  cdrFilters: (direction: Direction, location?: string) => {
    const params = new URLSearchParams({ direction });
    if (location) params.set('location', location);
    return request<CdrFilterOptions>(`/metrics/cdr-filters?${params}`);
  },
  cdrs: (query: CdrQuery) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    return request<CdrRow[]>(`/metrics/cdrs?${params}`);
  },
  liveCalls: () => request<LiveCallRow[]>('/metrics/live-calls'),
  cdrExports: () => request<CdrExportRow[]>('/metrics/cdr-exports'),
  rates: () => request<RateRow[]>('/metrics/rates'),
  rateDeck: (rateSheetId: string) =>
    download(`/metrics/rates/${encodeURIComponent(rateSheetId)}/download`),
  invoices: () => request<InvoiceRow[]>('/metrics/invoices'),
  transactions: () => request<TransactionRow[]>('/metrics/transactions'),

  // admin
  admin: {
    relationships: () => request<RelationshipRef[]>('/admin/relationships'),
    users: () => request<SessionUser[]>('/admin/users'),
    createUser: (input: { email: string; password: string; relationshipId: string; relationshipName: string }) =>
      request<{ user: SessionUser }>('/admin/users', { method: 'POST', body: JSON.stringify(input) }),
    updateUser: (id: string, patch: { password?: string; relationshipId?: string; relationshipName?: string }) =>
      request<{ user: SessionUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    deleteUser: (id: string) => request<{ ok: true }>(`/admin/users/${id}`, { method: 'DELETE' }),
  },
};
