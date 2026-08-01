import { useEffect, useState } from 'react';
import { api, type DashboardSummary, type OverviewSeries } from '../api/client';
import { Shell } from '../components/Shell';
import { OverviewChart } from '../components/OverviewChart';
import { brand } from '../theme/brand';

type Tab = { key: string; direction: 'termination' | 'origination'; metric: 'minutes' | 'attempts' };

const TABS: Tab[] = [
  { key: 'Termination Minutes', direction: 'termination', metric: 'minutes' },
  { key: 'Origination Minutes', direction: 'origination', metric: 'minutes' },
  { key: 'Termination Attempts', direction: 'termination', metric: 'attempts' },
  { key: 'Origination Attempts', direction: 'origination', metric: 'attempts' },
];

const fmt = (n: number) => Math.round(n).toLocaleString();
const money = (n: number) => `$${n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}`;

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [overview, setOverview] = useState<OverviewSeries | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.summary().then(setSummary).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    setOverview(null);
    api.overview(tab.direction, tab.metric).then(setOverview).catch((e) => setError(e.message));
  }, [tab]);

  const metrics = [
    { label: 'Running balance', value: summary ? money(summary.runningBalance) : '—', context: 'Current account balance' },
    { label: 'Minutes', value: summary ? fmt(summary.dailyMinutes) : '—', context: 'Processed today' },
    { label: 'Attempts', value: summary ? fmt(summary.dailyAttempts) : '—', context: 'Call attempts today' },
    { label: 'ASR', value: summary ? `${summary.dailyAsr.toFixed(2)}%` : '—', context: 'Answer-seizure ratio' },
    { label: 'ALOC', value: summary ? (summary.dailyAloc === null ? 'N / A' : summary.dailyAloc.toFixed(2)) : '—', context: 'Average call length' },
  ];

  return (
    <Shell title="Dashboard">
      {error && <div className="alert alert-error">{error}</div>}

      <section className="dashboard-intro">
        <div>
          <div className="dashboard-eyebrow">Today&apos;s network</div>
          <h2>Performance at a glance</h2>
          <p>Live traffic and account metrics for your carrier relationship.</p>
        </div>
        <div className="dashboard-live"><span />Systems operational</div>
      </section>

      <section className="kpi-strip" aria-label="Today's key metrics">
        {metrics.map((metric) => (
          <article className="kpi" key={metric.label}>
            <div className="kpi-head"><div className="kpi-label">{metric.label}</div><span className="kpi-mark" /></div>
            <div className="kpi-value">{metric.value}</div>
            <div className="kpi-context">{metric.context}</div>
          </article>
        ))}
      </section>

      <section className="panel chart-panel">
        <div className="dashboard-chart-head">
          <div>
            <div className="dashboard-eyebrow">Traffic analytics</div>
            <h2>Network overview</h2>
          </div>
          <div className="chart-controls">
            <span className="interval-label">15 min intervals</span>
            <select className="inline-select" defaultValue="all-day" aria-label="Period"><option value="all-day">All day</option></select>
          </div>
        </div>
        <div className="tabs chart-tabs">
          {TABS.map((item) => (
            <button key={item.key} className={`tab ${item.key === tab.key ? 'tab-active' : ''}`} onClick={() => setTab(item)}>{item.key}</button>
          ))}
        </div>
        {overview ? <OverviewChart data={overview} /> : <div className="chart-skeleton" />}
        <div className="legend">
          {overview?.series.map((series, index) => (
            <span key={series.label} className="legend-item"><span className="legend-swatch" style={{ background: brand.seriesPalette[index % brand.seriesPalette.length] }} />{series.label}</span>
          ))}
        </div>
      </section>
    </Shell>
  );
}
