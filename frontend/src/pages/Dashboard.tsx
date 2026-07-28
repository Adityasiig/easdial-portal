import { useEffect, useState } from 'react';
import { api, type DashboardSummary, type OverviewSeries } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Sidebar } from '../components/Sidebar';
import { StatCard } from '../components/StatCard';
import { OverviewChart } from '../components/OverviewChart';
import { brand } from '../theme/brand';

type Tab = { key: string; direction: 'termination' | 'origination'; metric: 'minutes' | 'attempts' };

const TABS: Tab[] = [
  { key: 'Termination Minutes', direction: 'termination', metric: 'minutes' },
  { key: 'Origination Minutes', direction: 'origination', metric: 'minutes' },
  { key: 'Termination Attempts', direction: 'termination', metric: 'attempts' },
];

const fmt = (n: number) => Math.round(n).toLocaleString();

export function Dashboard() {
  const { user, logout } = useAuth();
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
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <header className="topbar">
          <h1>Dashboard</h1>
          <div className="topbar-right">
            <span className="clock">{brand.tz}</span>
            <span className="who">{user?.email}</span>
            <button className="btn btn-link" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        <section className="stat-row">
          <StatCard
            label="Daily Minutes"
            value={summary ? fmt(summary.dailyMinutes) : '—'}
          />
          <StatCard
            label="Daily Attempts"
            value={summary ? fmt(summary.dailyAttempts) : '—'}
            sub={summary ? `/ ${fmt(summary.dailyAttemptsTarget)}` : undefined}
          />
          <StatCard
            label="Daily PRV"
            value={summary ? summary.dailyPrv.toFixed(2) : '—'}
            sub={summary ? `/ ${summary.dailyPrvTarget.toFixed(2)}` : undefined}
            negative={(summary?.dailyPrv ?? 0) < 0}
          />
          <StatCard
            label="Active Ports"
            value={summary ? fmt(summary.activePorts) : '—'}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Overview</h2>
            <span className="relationship-pill">Relationship {user?.relationshipId}</span>
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
            {overview?.series.map((s) => (
              <span key={s.label} className="legend-item">
                <span
                  className="legend-swatch"
                  style={{ background: brand.seriesColors[s.label] ?? '#888' }}
                />
                {s.label}
              </span>
            ))}
          </div>
        </section>

        <footer className="footer">
          EasDial Carrier Portal · data via PeerEdge · times in {brand.tz}
        </footer>
      </main>
    </div>
  );
}
