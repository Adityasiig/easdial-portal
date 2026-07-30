/** Minimal typed API client. Token is held in memory (no localStorage). */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export type Role = 'admin' | 'user';

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
  label: string;
  points: SeriesPoint[];
}
export interface OverviewSeries {
  direction: 'termination' | 'origination';
  metric: 'minutes' | 'attempts';
  granularityMinutes: number;
  series: NamedSeries[];
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
  overview: (direction: 'termination' | 'origination', metric: 'minutes' | 'attempts') =>
    request<OverviewSeries>(`/metrics/overview?direction=${direction}&metric=${metric}`),

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
