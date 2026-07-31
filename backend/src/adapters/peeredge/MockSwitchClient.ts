import type { SwitchDataClient } from './SwitchDataClient.js';
import type {
  DashboardSummary,
  MetricsQuery,
  NamedSeries,
  OverviewSeries,
  PerformanceRow,
  RelationshipRef,
  SeriesPoint,
} from './types.js';

/** Synthetic switch data for local development (no credentials). */
export class MockSwitchClient implements SwitchDataClient {
  private readonly buckets = 96;
  private readonly granularityMinutes = 15;

  private readonly sample: RelationshipRef[] = [
    { id: '499', name: 'ED- Tru Telco' },
    { id: '591', name: 'ED-ACE PEAK INVEST PTE LTD' },
    { id: '494', name: 'ED - Meta-Lynk LLC' },
    { id: '509', name: 'ED - My Country Mobile Pte Ltd' },
    { id: '548', name: 'ED - WOLFVOIP LLC' },
    { id: '540', name: 'ED - Joostream LLC' },
  ];

  async healthy(): Promise<boolean> {
    return true;
  }

  async listRelationships(): Promise<RelationshipRef[]> {
    return this.sample;
  }

  async getSummary(relationshipId: string): Promise<DashboardSummary> {
    const seed = this.seedFor(relationshipId);
    const minutes = this.dayCurve(seed).reduce((a, p) => a + p.value, 0);
    const attempts = Math.round(minutes * (6 + (seed % 3)));
    const prv = Math.round((minutes / 5000) * 100) / 100;
    return {
      date: new Date().toISOString().slice(0, 10),
      dailyMinutes: Math.round(minutes),
      dailyAttempts: attempts,
      dailyAttemptsTarget: attempts - 1_772,
      dailyPrv: -prv,
      dailyPrvTarget: -prv,
      activePorts: 40 + (seed % 90),
    };
  }

  async getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries> {
    const metric = query.metric ?? 'minutes';
    const seed = this.seedFor(relationshipId + query.direction + metric);
    const scale = metric === 'attempts' ? 7 : 1;
    const series: NamedSeries[] = [
      { label: 'Today', points: this.dayCurve(seed, scale, 1.0) },
      { label: 'Yesterday', points: this.dayCurve(seed + 7, scale, 0.92) },
      { label: 'Last week', points: this.dayCurve(seed + 31, scale, 1.08) },
    ];
    return { direction: query.direction, metric, granularityMinutes: this.granularityMinutes, series };
  }

  async getPerformance(
    relationshipId: string,
    direction: 'termination' | 'origination',
  ): Promise<PerformanceRow[]> {
    const routes = ['USA SD', 'USA Convo', 'Canada Flat', 'UK', 'Australia', 'India CC'];
    return routes.map((r, i) => {
      const seed = this.seedFor(relationshipId + direction + r);
      const attempts = 20_000 + (seed % 90_000) + i * 5_000;
      const asr = 20 + (seed % 45);
      const acd = 15 + (seed % 40);
      const minutes = Math.round((attempts * (asr / 100) * acd) / 60);
      const cost = Math.round(minutes * (0.004 + (seed % 20) / 10_000) * 100) / 100;
      const revenue = Math.round(cost * (0.85 + (seed % 30) / 100) * 100) / 100;
      return {
        name: r,
        attempts,
        asr: Math.round(asr * 100) / 100,
        acd,
        minutes,
        pdd: 300 + (seed % 400),
        cost,
        revenue,
        margin: Math.round((revenue - cost) * 100) / 100,
      };
    });
  }

  private seedFor(key: string): number {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return h % 997;
  }

  private dayCurve(seed: number, scale = 1, dayFactor = 1): SeriesPoint[] {
    const points: SeriesPoint[] = [];
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    for (let b = 0; b < this.buckets; b++) {
      const hour = (b * this.granularityMinutes) / 60;
      const base = Math.exp(-Math.pow(hour - 18, 2) / 40);
      const noise = ((seed + b * 13) % 17) / 100;
      const value = Math.max(0, (base * 12_000 + base * noise * 3_000) * scale * dayFactor);
      const ts = new Date(startOfDay.getTime() + b * this.granularityMinutes * 60_000);
      points.push({ ts: ts.toISOString(), value: Math.round(value) });
    }
    return points;
  }
}
