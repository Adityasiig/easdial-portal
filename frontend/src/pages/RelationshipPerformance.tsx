import { useEffect, useState } from 'react';
import { api, type Direction, type PartyRole, type RelPerformanceRow } from '../api/client';
import { Shell } from '../components/Shell';

const fmt = (n: number) => Math.round(n).toLocaleString();
const today = () => {
  const d = new Date();
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

type TopTab = { key: string; direction: Direction; capacity: boolean };
const TOP_TABS: TopTab[] = [
  { key: 'Termination', direction: 'termination', capacity: false },
  { key: 'Termination Capacity', direction: 'termination', capacity: true },
  { key: 'Origination', direction: 'origination', capacity: false },
  { key: 'Origination Capacity', direction: 'origination', capacity: true },
];

export function RelationshipPerformance() {
  const [top, setTop] = useState<TopTab>(TOP_TABS[0]);
  const [role, setRole] = useState<PartyRole>('customer');
  const [rows, setRows] = useState<RelPerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    api.relPerformance(top.direction, role).then(setRows).catch((e) => setError(e.message));
  }, [top, role]);

  return (
    <Shell title="Relationship Performance">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs page-tabs">
        {TOP_TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${t.key === top.key ? 'tab-active' : ''}`}
            onClick={() => setTop(t)}
          >
            {t.key}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <select className="control-select" defaultValue="today" aria-label="Range">
          <option value="today">Today</option>
        </select>
        <span className="date-pill">
          <CalendarIcon /> {today()} &nbsp;-&nbsp; {today()}
        </span>
      </div>

      <div className="tabs">
        {(['customer', 'vendor'] as PartyRole[]).map((r) => (
          <button key={r} className={`tab ${role === r ? 'tab-active' : ''}`} onClick={() => setRole(r)}>
            {r === 'customer' ? 'Customer' : 'Vendor'}
          </button>
        ))}
      </div>

      <section className="panel table-panel">
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Relationships</th>
                <th className="num">Attempts</th>
                <th className="num">Completions</th>
                <th className="num">Minutes</th>
                <th className="num">ASR %</th>
                <th className="num">ALOC</th>
                <th className="num">SDR %</th>
                <th className="num">MOS</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">{fmt(r.attempts)}</td>
                  <td className="num">{fmt(r.completions)}</td>
                  <td className="num">{fmt(r.minutes)}</td>
                  <td className="num">{r.asr.toFixed(2)}</td>
                  <td className="num">{r.aloc.toFixed(2)}</td>
                  <td className="num">{r.sdr.toFixed(2)}</td>
                  <td className="num">{r.mos.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows === null && <div className="chart-skeleton" style={{ height: 160 }} />}
        {rows !== null && rows.length === 0 && (
          <div className="empty-state">
            <EmptyBoxIcon />
            <div className="empty-sub">No Data</div>
          </div>
        )}
      </section>
    </Shell>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyBoxIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c3cad6" strokeWidth="1.6" aria-hidden>
      <path d="M4 9l8-4 8 4-8 4-8-4z" />
      <path d="M4 9v6l8 4 8-4V9" />
    </svg>
  );
}
