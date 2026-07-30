import type { SwitchDataClient } from './SwitchDataClient.js';
import type { DashboardSummary, MetricsQuery, OverviewSeries, RelationshipRef } from './types.js';
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
 * metrics endpoint. Until confirmed, getSummary/getOverview return an empty shape
 * in rest mode (see mapRelationship* TODOs). The relationship LIST is already live.
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
    const row = await this.fetchRelationshipRow(relationshipId);
    const n = (k: string) => Number(row?.[k] ?? 0);
    return {
      date: new Date().toISOString().slice(0, 10),
      dailyMinutes: n('minutes'),
      dailyAttempts: n('attempts'),
      dailyAttemptsTarget: n('attempts'),
      dailyPrv: n('ppma'),
      dailyPrvTarget: n('ppma'),
      activePorts: 0, // per-relationship ports: confirm endpoint
    };
  }

  async getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries> {
    // TODO: confirm the per-relationship graph endpoint with live admin creds.
    logger.warn({ relationshipId }, 'per-relationship overview endpoint pending confirmation');
    return {
      direction: query.direction,
      metric: query.metric ?? 'minutes',
      granularityMinutes: 15,
      series: [
        { label: 'Today', points: [] },
        { label: 'Yesterday', points: [] },
        { label: 'Last week', points: [] },
      ],
    };
  }

  /**
   * Best-effort per-relationship performance row. The switch exposes
   * relationship_performance; the exact per-ID filter is confirmed live. Returns
   * null until wired, so getSummary degrades to zeros rather than wrong numbers.
   */
  private async fetchRelationshipRow(_relationshipId: string): Promise<Record<string, unknown> | null> {
    // TODO(confirm-with-creds): call the per-relationship performance endpoint and
    // return this relationship's row. Left null intentionally until confirmed.
    return null;
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
