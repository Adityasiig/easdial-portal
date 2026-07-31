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
    { icon: '$', label: 'Running Balance', value: summary ? money(summary.runningBalance) : '—', meta: 'Current account position', featured: true },
    { icon: 'M', label: 'Daily Minutes', value: summary ? fmt(summary.dailyMinutes) : '—', meta: 'Connected traffic' },
    { icon: 'A', label: 'Daily Attempts', value: summary ? fmt(summary.dailyAttempts) : '—', meta: 'Total call attempts' },
    { icon: '%', label: 'Daily ASR', value: summary ? `${summary.dailyAsr.toFixed(2)}%` : '—', meta: 'Answer-seizure ratio' },
    { icon: 'T', label: 'Daily ALOC', value: summary ? (summary.dailyAloc === null ? 'N / A' : summary.dailyAloc.toFixed(2)) : '—', meta: 'Average call duration' },
  ];

  return (
    <Shell title="Dashboard">
      {error && <div className="alert alert-error">{error}</div>}
      <section className="dashboard-intro">
        <div><span className="section-kicker">Today's performance</span><h2>Network at a glance</h2><p>Live commercial and traffic signals across your carrier relationship.</p></div>
        <div className="dashboard-date"><span className="status-dot" /> Data refreshes automatically</div>
      </section>

      <section className="kpi-strip">
        {metrics.map((metric) => (
          <div className={`kpi ${metric.featured ? 'kpi-featured' : ''}`} key={metric.label}>
            <div className="kpi-icon">{metric.icon}</div><div className="kpi-label">{metric.label}</div>
            <div className="kpi-value">{metric.value}</div><div className="kpi-meta">{metric.meta}</div>
          </div>
        ))}
      </section>

      <section className="panel chart-panel">
        <div className="panel-head panel-head-left">
          <div><span className="section-kicker">Traffic analytics</span><h2>Overview</h2></div>
          <select className="inline-select" defaultValue="all-day" aria-label="Period"><option value="all-day">All day</option></select>
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
