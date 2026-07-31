import type { SwitchDataClient } from './SwitchDataClient.js';
import type {
  CdrRow,
  DashboardSummary,
  Direction,
  InvoiceRow,
  MetricsQuery,
  NamedSeries,
  NumberingRow,
  OverviewSeries,
  PartyRole,
  PaymentRow,
  RateRow,
  RelationshipRef,
  RelPerformanceRow,
  SeriesPoint,
  TransactionRow,
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
    const minutes = this.dayCurve(seed).reduce((a, p) => a + p.value, 0) / 1000;
    const attempts = Math.round(minutes * (6 + (seed % 3)));
    const asr = 20 + (seed % 45);
    return {
      date: new Date().toISOString().slice(0, 10),
      runningBalance: -(300 + (seed % 900)) - 0.28,
      dailyMinutes: Math.round(minutes),
      dailyAttempts: attempts,
      dailyAsr: Math.round(asr * 100) / 100,
      dailyAloc: Math.round((15 + (seed % 40)) / 6 * 100) / 100,
    };
  }

  async getOverview(relationshipId: string, query: MetricsQuery): Promise<OverviewSeries> {
    const metric = query.metric ?? 'minutes';
    const seed = this.seedFor(relationshipId + query.direction + metric);
    const scale = metric === 'attempts' ? 7 : 1;
    const rel = this.sample.find((r) => r.id === relationshipId);
    const base = rel ? rel.name.replace(/^ED\s*-?\s*/i, 'ED-') : `Relationship ${relationshipId}`;
    const series: NamedSeries[] = [
      { label: `${base} USA SD`, points: this.dayCurve(seed, scale, 1.0) },
      { label: `${base} USA SD STATIC`, points: this.dayCurve(seed + 7, scale, 0.65) },
    ];
    return { direction: query.direction, metric, granularityMinutes: this.granularityMinutes, series };
  }

  async getRelPerformance(
    relationshipId: string,
    direction: Direction,
    role: PartyRole,
  ): Promise<RelPerformanceRow[]> {
    const rel = this.sample.find((r) => r.id === relationshipId);
    const base = rel ? rel.name : `Relationship ${relationshipId}`;
    const trunks = [`${base} USA SD`, `${base} USA SD STATIC`, `${base} USA Flat`];
    return trunks.map((name, i) => {
      const seed = this.seedFor(relationshipId + direction + role + name);
      const attempts = 8_000 + (seed % 60_000) + i * 3_000;
      const asr = 18 + (seed % 42);
      const completions = Math.round(attempts * (asr / 100));
      const aloc = Math.round((1.5 + (seed % 45) / 10) * 100) / 100;
      const minutes = Math.round(completions * aloc);
      return {
        name,
        attempts,
        completions,
        minutes,
        asr: Math.round(asr * 100) / 100,
        aloc,
        sdr: Math.round(((seed % 180) / 10) * 100) / 100,
        mos: Math.round((3.4 + (seed % 12) / 10) * 100) / 100,
      };
    });
  }

  async getNumbering(relationshipId: string): Promise<NumberingRow[]> {
    const seed = this.seedFor(relationshipId + 'num');
    return Array.from({ length: 4 }, (_, i) => ({
      number: `1878${String(200_0000 + seed * 7 + i * 111).padStart(7, '0')}`,
      type: i % 2 === 0 ? 'DID' : 'Toll-Free',
      lastModified: this.recentDate(i * 3 + (seed % 5)),
      modifiedBy: 'system',
    }));
  }

  async getCdrs(relationshipId: string, direction: Direction): Promise<CdrRow[]> {
    const seed = this.seedFor(relationshipId + direction + 'cdr');
    const rel = this.sample.find((r) => r.id === relationshipId);
    const trunk = `${rel ? rel.name : relationshipId} / USA SD`;
    const causes: Array<[string, string]> = [
      ['16', 'NORMAL_CLEARING'],
      ['17', 'USER_BUSY'],
      ['18', 'NO_USER_RESPONSE'],
      ['21', 'CALL_REJECTED'],
      ['34', 'NORMAL_CIRCUIT_CONGESTION'],
    ];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return Array.from({ length: 12 }, (_, i) => {
      const s = (seed + i * 37) % 997;
      const [code, cause] = causes[s % causes.length];
      const answered = code === '16';
      const ts = new Date(today.getTime() + ((8 + (s % 12)) * 60 + (s % 60)) * 60_000 + i * 90_000);
      return {
        dateTime: ts.toISOString(),
        ani: `1214${String(5_000_000 + s * 731).slice(0, 7)}`,
        dnis: `1972${String(2_000_000 + s * 613).slice(0, 7)}`,
        lrn: `1469${String(3_000_000 + s * 419).slice(0, 7)}`,
        releaseCode: code,
        releaseCause: cause,
        duration: answered ? 30 + (s % 600) : 0,
        relationshipTrunk: trunk,
        origJuris: s % 3 === 0 ? 'INTERSTATE' : s % 3 === 1 ? 'INTRASTATE' : 'INDETERMINATE',
        rate: Math.round((0.002 + (s % 40) / 10_000) * 100_000) / 100_000,
      };
    });
  }

  async getRates(relationshipId: string): Promise<RateRow[]> {
    const rel = this.sample.find((r) => r.id === relationshipId);
    const base = rel ? rel.name : `Relationship ${relationshipId}`;
    const seed = this.seedFor(relationshipId + 'rates');
    return [
      {
        name: `${base} USA SD`,
        trunkGroups: 2,
        direction: 'Termination',
        relationship: 'Vendor',
        location: 'US & Canada',
        type: 'Prefix Jurisdiction (NPANXX)',
        totalRates: 150_000 + (seed % 60_000),
        expirationDate: null,
        modified: this.recentDate(seed % 90),
      },
      {
        name: `${base} USA Flat`,
        trunkGroups: 0,
        direction: 'Termination',
        relationship: 'Vendor',
        location: 'US & Canada',
        type: 'Prefix Jurisdiction (NPANXX)',
        totalRates: 140_000 + (seed % 50_000),
        expirationDate: null,
        modified: this.recentDate((seed % 90) + 60),
      },
    ];
  }

  async getInvoices(relationshipId: string): Promise<InvoiceRow[]> {
    const seed = this.seedFor(relationshipId + 'inv');
    return Array.from({ length: 3 }, (_, i) => {
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - i);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCDate(0);
      return {
        invoiceNumber: `INV-${2026_000 + seed + i}`,
        validity: 'Valid',
        createdAt: end.toISOString().slice(0, 10),
        startEndDate: `${start.toISOString().slice(0, 10)} — ${end.toISOString().slice(0, 10)}`,
        invoiceCycle: 'Monthly',
        invoiceAmount: Math.round((900 + (seed % 4000) + i * 350) * 100) / 100,
        tag: i === 0 ? 'Current' : 'Paid',
      };
    });
  }

  async getTransactions(relationshipId: string): Promise<TransactionRow[]> {
    const seed = this.seedFor(relationshipId + 'txn');
    let balance = -(300 + (seed % 900)) - 0.28;
    const rows: TransactionRow[] = [];
    for (let i = 0; i < 6; i++) {
      const credit = i % 2 === 0;
      const amount = Math.round((150 + ((seed + i * 53) % 800)) * 100) / 100;
      const date = this.recentDate(i * 5 + (seed % 4));
      rows.push({
        date,
        transaction: credit ? 'Payment Received' : 'Usage Charge',
        type: credit ? 'Credit' : 'Payment',
        transactionDate: date,
        amount: credit ? amount : -amount,
        runningBalance: Math.round(balance * 100) / 100,
        paymentMemo: credit ? 'PayPal payment' : 'Daily usage settlement',
        addedFrom: credit ? 'PayPal' : 'System',
      });
      balance += credit ? -amount : amount;
    }
    return rows;
  }

  async getPayments(relationshipId: string): Promise<PaymentRow[]> {
    const rel = this.sample.find((r) => r.id === relationshipId);
    const base = rel ? rel.name : `Relationship ${relationshipId}`;
    const seed = this.seedFor(relationshipId + 'pay');
    return Array.from({ length: 2 }, (_, i) => {
      const amount = Math.round((250 + ((seed + i * 97) % 1200)) * 100) / 100;
      return {
        carrierName: base,
        description: 'Balance top-up',
        invoiceId: `INV-${2026_000 + seed + i}`,
        totalAmount: amount,
        paidTo: 'accounts@dialphone.ai',
        paypalFee: Math.round(amount * 0.029 * 100) / 100,
        purchasedAt: this.recentDate(i * 9 + (seed % 6)),
        reason: 'Prepaid balance',
        status: 'Completed',
      };
    });
  }

  private recentDate(daysAgo: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
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
