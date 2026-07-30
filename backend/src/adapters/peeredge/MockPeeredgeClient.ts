import type { PeeredgeClient } from './PeeredgeClient.js';
import type {
  DashboardSummary,
  Identity,
  MetricsQuery,
  NamedSeries,
  OverviewSeries,
  SeriesPoint,
} from './types.js';

/**
 * Deterministic, realistic mock of the Peeredge reporting data for local UI
 * development (no credentials needed). Seeded by the login email so different
 * logins get stable-but-distinct numbers. Not used in production (rest mode).
 */
export class MockPeeredgeClient implements PeeredgeClient {
  private readonly buckets = 96; // 24h at 15-min granularity
  private readonly granularityMinutes = 15;

  constructor(private readonly email = 'demo@easdial.com') {}

  async healthy(): Promise<boolean> {
    return true;
  }

  async whoami(): Promise<Identity> {
    return { email: this.email, name: 'Mock Carrier', relationshipId: 'REL-MOCK' };
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const seed = this.seedFor(this.email);
    const minutes = this.dayCurve(seed).reduce((a, p) => a + p.value, 0);
    const attempts = Math.round(minutes * (6 + (seed % 3)));
    const prv = Math.round((minutes / 5000) * 100) / 100;
    return {
      date: this.today(),
      dailyMinutes: Math.round(minutes),
      dailyAttempts: attempts,
      dailyAttemptsTarget: attempts - 1_772,
      dailyPrv: -prv,
      dailyPrvTarget: -prv,
      activePorts: 120 + (seed % 40),
    };
  }

  async getOverviewSeries(query: MetricsQuery): Promise<OverviewSeries> {
    const metric = query.metric ?? 'minutes';
    const seed = this.seedFor(this.email + query.direction + metric);
    const scale = metric === 'attempts' ? 7 : 1;

    const series: NamedSeries[] = [
      { label: 'Today', points: this.dayCurve(seed, scale, 1.0) },
      { label: 'Yesterday', points: this.dayCurve(seed + 7, scale, 0.92) },
      { label: 'Last week', points: this.dayCurve(seed + 31, scale, 1.08) },
    ];

    return {
      direction: query.direction,
      metric,
      granularityMinutes: this.granularityMinutes,
      series,
    };
  }

  // --- helpers -----------------------------------------------------------

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private seedFor(key: string): number {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return h % 997;
  }

  /** Business-day traffic curve, deterministic (no Math.random). */
  private dayCurve(seed: number, scale = 1, dayFactor = 1): SeriesPoint[] {
    const points: SeriesPoint[] = [];
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    for (let b = 0; b < this.buckets; b++) {
      const hour = (b * this.granularityMinutes) / 60;
      const base = Math.exp(-Math.pow(hour - 18, 2) / 40);
      const noise = ((seed + b * 13) % 17) / 100;
      const value = Math.max(0, (base * 55_000 + base * noise * 8_000) * scale * dayFactor);
      const ts = new Date(startOfDay.getTime() + b * this.granularityMinutes * 60_000);
      points.push({ ts: ts.toISOString(), value: Math.round(value) });
    }
    return points;
  }
}
