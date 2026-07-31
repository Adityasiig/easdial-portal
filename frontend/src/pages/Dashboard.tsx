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

  useEffect(() => {
    api.summary().then(setSummary).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setOverview(null);
    api.overview(tab.direction, tab.metric).then(setOverview).catch((e) => setError(e.message));
  }, [tab]);

  return (
    <Shell title="Dashboard">
      {error && <div className="alert alert-error">{error}</div>}

      <section className="kpi-strip">
        <div className="kpi">
          <div className="kpi-label">Running Balance</div>
          <div className="kpi-value">{summary ? money(summary.runningBalance) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Daily Minutes</div>
          <div className="kpi-value">{summary ? fmt(summary.dailyMinutes) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Daily Attempts</div>
          <div className="kpi-value">{summary ? fmt(summary.dailyAttempts) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Daily ASR</div>
          <div className="kpi-value">{summary ? `${summary.dailyAsr.toFixed(2)}%` : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Daily ALOC</div>
          <div className="kpi-value">
            {summary ? (summary.dailyAloc === null ? 'N / A' : summary.dailyAloc.toFixed(2)) : '—'}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head panel-head-left">
          <h2>Overview</h2>
          <select className="inline-select" defaultValue="all-day" aria-label="Period">
            <option value="all-day">All Day</option>
          </select>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${t.key === tab.key ? 'tab-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.key}
            </button>
          ))}
        </div>

        {overview ? <OverviewChart data={overview} /> : <div className="chart-skeleton" />}

        <div className="legend">
          {overview?.series.map((s, i) => (
            <span key={s.label} className="legend-item">
              <span
                className="legend-swatch"
                style={{ background: brand.seriesPalette[i % brand.seriesPalette.length] }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </section>
    </Shell>
  );
}
