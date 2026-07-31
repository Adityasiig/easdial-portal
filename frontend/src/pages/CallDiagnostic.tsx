import { useEffect, useState } from 'react';
import { api, type CdrRow, type Direction } from '../api/client';
import { Shell } from '../components/Shell';

const TOP_TABS = ['Termination', 'Origination', 'Live Calls', 'CDR Export'] as const;
type TopTab = (typeof TOP_TABS)[number];
const STATUS_TABS = ['All', 'Completed', 'Failed'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const dt = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()}`;
};

export function CallDiagnostic() {
  const [top, setTop] = useState<TopTab>('Termination');
  const [status, setStatus] = useState<StatusTab>('All');
  const [rows, setRows] = useState<CdrRow[] | null>(null);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const direction: Direction = top === 'Origination' ? 'origination' : 'termination';
  const isCdrTab = top === 'Termination' || top === 'Origination';

  useEffect(() => {
    setRows(null);
    setGenerated(false);
  }, [top]);

  const generate = () => {
    setError(null);
    setRows(null);
    setGenerated(true);
    api.cdrs(direction).then(setRows).catch((e) => setError(e.message));
  };

  const reset = () => {
    setRows(null);
    setGenerated(false);
    setQ('');
  };

  const filtered = rows?.filter((r) => {
    if (status === 'Completed' && r.duration === 0) return false;
    if (status === 'Failed' && r.duration > 0) return false;
    if (q && !(r.ani.includes(q) || r.dnis.includes(q) || r.releaseCause.toLowerCase().includes(q.toLowerCase())))
      return false;
    return true;
  });

  return (
    <Shell title="Call Diagnostic">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs page-tabs">
        {TOP_TABS.map((t) => (
          <button key={t} className={`tab ${t === top ? 'tab-active' : ''}`} onClick={() => setTop(t)}>
            {t}
          </button>
        ))}
      </div>

      {!isCdrTab ? (
        <section className="panel table-panel">
          <div className="empty-state">
            <div className="empty-title">
              {top === 'Live Calls' ? 'No live calls right now.' : 'CDR exports appear here once generated.'}
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="filter-row">
            <select className="control-select" defaultValue="today" aria-label="Range">
              <option value="today">Today</option>
            </select>
            <span className="date-pill">
              {dt()}, 00:00:00 &nbsp;-&nbsp; {dt()}, 23:59:59
            </span>
          </div>

          <div className="filter-row">
            <select className="control-select" defaultValue="dallas" aria-label="Switch">
              <option value="dallas">dallas</option>
            </select>
            <select className="control-select" defaultValue="" aria-label="Trunk group">
              <option value="">Select Trunk Group</option>
            </select>
            <input className="control-input" placeholder="ANI" />
            <input className="control-input" placeholder="Dialed Number" />
          </div>

          <div className="tabs">
            {STATUS_TABS.map((s) => (
              <button key={s} className={`tab ${s === status ? 'tab-active' : ''}`} onClick={() => setStatus(s)}>
                {s}
              </button>
            ))}
          </div>

          <section className="panel table-panel">
            <div className="table-toolbar">
              <input
                className="search-input"
                placeholder="Search..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="toolbar-actions">
                <button className="btn btn-primary btn-sm" onClick={generate}>
                  Generate
                </button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>
                  ✕ Reset
                </button>
                <button className="btn btn-ghost btn-sm" disabled>
                  Export
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date + Time</th>
                    <th>ANI</th>
                    <th>DNIS</th>
                    <th>LRN</th>
                    <th>Release Code</th>
                    <th>Release Cause</th>
                    <th className="num">Duration</th>
                    <th>Relationship / Trunk</th>
                    <th>Orig Juris</th>
                    <th className="num">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.map((r, i) => (
                    <tr key={i}>
                      <td>{new Date(r.dateTime).toISOString().replace('T', ' ').slice(0, 19)}</td>
                      <td>{r.ani}</td>
                      <td>{r.dnis}</td>
                      <td>{r.lrn}</td>
                      <td>{r.releaseCode}</td>
                      <td>{r.releaseCause}</td>
                      <td className="num">{r.duration}</td>
                      <td>{r.relationshipTrunk}</td>
                      <td>{r.origJuris}</td>
                      <td className="num">{r.rate.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {generated && rows === null && !error && <div className="chart-skeleton" style={{ height: 160 }} />}
            {(!generated || (filtered !== undefined && filtered.length === 0)) && (
              <div className="empty-state">
                <BriefcaseIcon />
                <div className="empty-title">No Record Found</div>
                {!generated && <div className="empty-sub">Press Generate to run the report.</div>}
              </div>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c3cad6" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18" />
    </svg>
  );
}
