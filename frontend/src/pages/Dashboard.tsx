import { useEffect, useMemo, useState } from 'react';
import { api, type DashboardMetric, type DashboardSummary, type OverviewSeries } from '../api/client';
import { Shell } from '../components/Shell';
import { OverviewChart } from '../components/OverviewChart';
import { brand } from '../theme/brand';

type Tab = { label: string; direction: 'termination' | 'origination'; metric: DashboardMetric };
type PeriodHours = 24 | 12 | 6 | 4 | 2;

const TABS: Tab[] = [
  { label: 'Termination Minutes', direction: 'termination', metric: 'minutes' },
  { label: 'Origination Minutes', direction: 'origination', metric: 'minutes' },
  { label: 'Termination Attempts', direction: 'termination', metric: 'attempts' },
  { label: 'Origination Attempts', direction: 'origination', metric: 'attempts' },
  { label: 'Ports', direction: 'termination', metric: 'ports' },
  { label: 'Favorite Ports', direction: 'termination', metric: 'favorite_ports' },
  { label: 'CPS', direction: 'termination', metric: 'cps' },
  { label: 'Profit', direction: 'termination', metric: 'profit' },
];

const fmt = (value: number) => Math.round(value).toLocaleString();
const money = (value: number) => `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tab, setTab] = useState(TABS[0]);
  const [periodHours, setPeriodHours] = useState<PeriodHours>(24);
  const [overview, setOverview] = useState<OverviewSeries | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.summary().then(setSummary).catch((err) => setError(err.message)); }, []);
  useEffect(() => {
    setOverview(null);
    setError(null);
    api.overview(tab.direction, tab.metric).then(setOverview).catch((err) => setError(err.message));
  }, [tab]);

  const visibleOverview = useMemo(() => {
    if (!overview || periodHours === 24) return overview;
    const count = Math.ceil((periodHours * 60) / overview.granularityMinutes);
    return { ...overview, series: overview.series.map((series) => ({ ...series, points: series.points.slice(-count) })) };
  }, [overview, periodHours]);

  const metrics = [
    ['Running Balance', summary ? money(summary.runningBalance) : '—'],
    ['Daily Minutes', summary ? fmt(summary.dailyMinutes) : '—'],
    ['Daily Attempts', summary ? fmt(summary.dailyAttempts) : '—'],
    ['Daily ASR', summary ? `${summary.dailyAsr.toFixed(2)}%` : '—'],
    ['Daily ALOC', summary ? (summary.dailyAloc === null ? 'N/A' : summary.dailyAloc.toFixed(2)) : '—'],
  ];

  return (
    <Shell title="Dashboard">
      {error && <div className="alert alert-error">{error}</div>}

      <section className="dashboard-kpis" aria-label="Daily account statistics">
        {metrics.map(([label, value]) => (
          <article className="dashboard-kpi" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel peeredge-chart-panel">
        <div className="peeredge-overview-head">
          <h2>Overview</h2>
          <select className="overview-period" value={periodHours} aria-label="Dashboard time range" onChange={(event) => setPeriodHours(Number(event.target.value) as PeriodHours)}>
            <option value={2}>2 hours</option>
            <option value={4}>4 hours</option>
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>All day</option>
          </select>
        </div>
        <div className="tabs peeredge-chart-tabs" role="tablist" aria-label="Dashboard graph">
          {TABS.map((item) => (
            <button key={item.label} role="tab" aria-selected={item.label === tab.label} className={`tab ${item.label === tab.label ? 'tab-active' : ''}`} onClick={() => setTab(item)}>{item.label}</button>
          ))}
        </div>
        {visibleOverview ? <OverviewChart data={visibleOverview} /> : <div className="chart-skeleton" />}
        <div className="legend">
          {visibleOverview?.series.map((series, index) => (
            <span key={series.label} className="legend-item"><span className="legend-swatch" style={{ background: brand.seriesPalette[index % brand.seriesPalette.length] }} />{series.label}</span>
          ))}
        </div>
      </section>
    </Shell>
  );
}
