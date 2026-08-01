/** Minimal typed API client. Token is held in memory (no localStorage). */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type Role = 'admin' | 'user';
export type Direction = 'termination' | 'origination';
export type PartyRole = 'customer' | 'vendor';

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
  metric: 'minutes' | 'attempts';
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
  relationshipTrunk: string;
  origJuris: string;
  rate: number;
}

export type CdrStatus = 'all' | 'completed' | 'failed';

export interface CdrQuery {
  direction: Direction;
  startTime: string;
  endTime: string;
  location?: string;
  trunkGroupId?: string;
  trunkGroupLabel?: string;
  ani?: string;
  dnis?: string;
  status: CdrStatus;
}

export interface CdrFilterOptions {
  locations: string[];
  trunkGroups: Array<{ id: string; label: string }>;
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

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
export function setToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? 'Request failed');
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: SessionUser }>('/auth/me'),

  // metrics (scoped to the caller's allocated relationship)
  summary: () => request<DashboardSummary>('/metrics/summary'),
  overview: (direction: Direction, metric: 'minutes' | 'attempts') =>
    request<OverviewSeries>(`/metrics/overview?direction=${direction}&metric=${metric}`),
  relPerformance: (direction: Direction, role: PartyRole) =>
    request<RelPerformanceRow[]>(`/metrics/relationship-performance?direction=${direction}&role=${role}`),
  numbering: () => request<NumberingRow[]>('/metrics/numbering'),
  cdrFilters: (direction: Direction) => request<CdrFilterOptions>(`/metrics/cdr-filters?direction=${direction}`),
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
  invoices: () => request<InvoiceRow[]>('/metrics/invoices'),
  transactions: () => request<TransactionRow[]>('/metrics/transactions'),
  payments: () => request<PaymentRow[]>('/metrics/payments'),

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
