import type { PeeredgeClient } from './PeeredgeClient.js';
import type {
  DashboardSummary,
  Direction,
  Identity,
  MetricsQuery,
  NamedSeries,
  OverviewSeries,
  SeriesPoint,
} from './types.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';
import { PeeredgeSession } from './PeeredgeSession.js';

/**
 * Live client for the PeerEdge relationship API (api-*.peeredge.com).
 * Endpoints/params marked CONFIRMED were seen in captured traffic; ASSUMED ones
 * need one live-traffic capture to lock down (see PEEREDGE_API.md).
 */
export class RestPeeredgeClient implements PeeredgeClient {
  private readonly base: string; // e.g. https://api-dialphone.peeredge.com/api/v2/relationship

  constructor(
    baseUrl: string,
    private readonly session: PeeredgeSession,
  ) {
    this.base = `${baseUrl.replace(/\/$/, '')}/api/v2/relationship`;
  }

  async healthy(): Promise<boolean> {
    try {
      const res = await this.get('/me'); // CONFIRMED
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Verify auth + return identity (Peeredge `/me`). Throws on bad credentials. */
  async whoami(): Promise<Identity> {
    const raw = await this.getJson<{ user?: Record<string, any> }>('/me');
    const u = raw.user ?? {};
    return {
      email: String(u.email ?? ''),
      name: String(u.user_name ?? u.name ?? 'Carrier'),
      relationshipId: String(u.carrier_id ?? u.relationship_id ?? ''),
    };
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    // CONFIRMED endpoints. cps_ports -> ports; statistics -> KPI rows + balance.
    const [ports, stats] = await Promise.all([
      this.getJson<{ ports?: number; cps?: number }>('/dashboard/cps_ports'),
      this.getJson<{ data?: unknown[]; present_balance?: string }>('/dashboard/statistics'),
    ]);

    // ASSUMED: which fields inside statistics.data hold minutes/attempts/PRV.
    // statistics.data was empty at capture; map best-effort and default to 0.
    const row = (Array.isArray(stats.data) ? (stats.data[0] as Record<string, any>) : {}) ?? {};
    const num = (...keys: string[]) => {
      for (const k of keys) if (row[k] != null) return Number(row[k]);
      return 0;
    };

    return {
      date: new Date().toISOString().slice(0, 10),
      dailyMinutes: num('minutes', 'daily_minutes', 'total_minutes'),
      dailyAttempts: num('attempts', 'daily_attempts', 'total_attempts'),
      dailyAttemptsTarget: num('attempts_target', 'target_attempts'),
      dailyPrv: num('prv', 'daily_prv'),
      dailyPrvTarget: num('prv_target'),
      activePorts: Number(ports.ports ?? 0), // CONFIRMED
    };
  }

  async getOverviewSeries(query: MetricsQuery): Promise<OverviewSeries> {
    const trafficDirection = query.direction === 'origination' ? 'O' : 'T'; // CONFIRMED: T
    const trafficType = query.metric === 'attempts' ? 'attempts' : 'minutes'; // minutes CONFIRMED

    // The portal fetches /dashboard/graphs per duration. "Today" CONFIRMED;
    // "Yesterday"/"Last Week" ASSUMED — confirm exact strings from a live capture.
    const durations: Array<NamedSeries['label']> = ['Today', 'Yesterday', 'Last week'];

    const series: NamedSeries[] = [];
    for (const label of durations) {
      const raw = await this.getJson<Array<Record<string, unknown[]>>>(
        `/dashboard/graphs?traffic_type=${trafficType}&traffic_direction=${trafficDirection}&duration=${encodeURIComponent(
          label,
        )}`,
      ).catch((e) => {
        logger.warn({ err: e, label }, 'graphs fetch failed for duration');
        return [] as Array<Record<string, unknown[]>>;
      });
      series.push({ label, points: aggregateTrunks(raw) });
    }

    return {
      direction: query.direction,
      metric: trafficType === 'attempts' ? 'attempts' : 'minutes',
      granularityMinutes: 15, // ASSUMED
      series,
    };
  }

  // --- HTTP with auto re-auth on 401 -------------------------------------

  private async get(path: string): Promise<Response> {
    const url = `${this.base}${path}`;
    const doFetch = async () =>
      fetch(url, { headers: await this.session.requestHeaders() });

    let res = await this.withTimeout(doFetch());
    if (res.status === 401 || res.status === 403) {
      await this.session.refresh();
      res = await this.withTimeout(doFetch());
    }
    return res;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.get(path);
    if (!res.ok) throw new AppError(502, 'peeredge_upstream', `${path} returned ${res.status}`);
    return (await res.json()) as T;
  }

  private async withTimeout(p: Promise<Response>, ms = 15_000): Promise<Response> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AppError(504, 'peeredge_timeout', 'PeerEdge timeout')), ms);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}

/**
 * The graphs endpoint returns [{ "<trunk name>": [ ...points ] }, ...].
 * Sum values across all trunks at each bucket into one aggregated line.
 * Point shape was empty at capture — this normalizer handles the common shapes;
 * confirm against live data (PEEREDGE_API.md).
 */
function aggregateTrunks(raw: Array<Record<string, unknown[]>>): SeriesPoint[] {
  const byTime = new Map<string, number>();
  for (const obj of raw ?? []) {
    for (const points of Object.values(obj ?? {})) {
      for (const p of (points as unknown[]) ?? []) {
        const { ts, value } = normalizePoint(p);
        if (ts == null) continue;
        byTime.set(ts, (byTime.get(ts) ?? 0) + value);
      }
    }
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ts, value]) => ({ ts, value }));
}

function normalizePoint(p: unknown): { ts: string | null; value: number } {
  if (Array.isArray(p)) return { ts: String(p[0]), value: Number(p[1] ?? 0) };
  if (p && typeof p === 'object') {
    const o = p as Record<string, any>;
    const ts = o.ts ?? o.time ?? o.timestamp ?? o.x ?? o.minute ?? o.label ?? null;
    const value = o.value ?? o.y ?? o.count ?? o.minutes ?? o.total ?? 0;
    return { ts: ts == null ? null : String(ts), value: Number(value) };
  }
  return { ts: null, value: 0 };
}

export type { Direction };
