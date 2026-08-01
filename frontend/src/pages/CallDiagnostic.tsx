import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type CdrExportRow,
  type CdrRow,
  type Direction,
  type LiveCallRow,
} from '../api/client';
import { Shell } from '../components/Shell';

const TOP_TABS = ['Termination', 'Origination', 'Live Calls', 'CDR Export'] as const;
type TopTab = (typeof TOP_TABS)[number];
const STATUS_TABS = ['All', 'Completed', 'Failed'] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const today = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
};

export function CallDiagnostic() {
  const [top, setTop] = useState<TopTab>('Termination');
  const [status, setStatus] = useState<StatusTab>('All');
  const [rows, setRows] = useState<CdrRow[] | null>(null);
  const [liveRows, setLiveRows] = useState<LiveCallRow[] | null>(null);
  const [exportRows, setExportRows] = useState<CdrExportRow[] | null>(null);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const direction: Direction = top === 'Origination' ? 'origination' : 'termination';
  const isCdrTab = top === 'Termination' || top === 'Origination';

  useEffect(() => {
    setQ('');
    setError(null);
    if (top === 'Live Calls') {
      setLiveRows(null);
      api.liveCalls().then(setLiveRows).catch((err) => setError(err.message));
    } else if (top === 'CDR Export') {
      setExportRows(null);
      api.cdrExports().then(setExportRows).catch((err) => setError(err.message));
    } else {
      setRows(null);
      setGenerated(false);
    }
  }, [top]);

  const generate = () => {
    setError(null);
    setRows(null);
    setGenerated(true);
    api.cdrs(direction).then(setRows).catch((err) => setError(err.message));
  };

  const reset = () => {
    setRows(null);
    setGenerated(false);
    setQ('');
    setStatus('All');
  };

  const filtered = useMemo(() => rows?.filter((row) => {
    if (status === 'Completed' && row.duration === 0) return false;
    if (status === 'Failed' && row.duration > 0) return false;
    const term = q.toLowerCase();
    return !term || row.ani.includes(term) || row.dnis.includes(term) || row.releaseCause.toLowerCase().includes(term);
  }), [q, rows, status]);

  return (
    <Shell title="Call Diagnostic">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="tabs page-tabs">
        {TOP_TABS.map((tab) => (
          <button key={tab} className={`tab ${tab === top ? 'tab-active' : ''}`} onClick={() => setTop(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {top === 'Live Calls' && (
        <LiveCallsPanel rows={liveRows} query={q} setQuery={setQ} refresh={() => {
          setLiveRows(null);
          api.liveCalls().then(setLiveRows).catch((err) => setError(err.message));
        }} />
      )}
      {top === 'CDR Export' && <CdrExportsPanel rows={exportRows} query={q} setQuery={setQ} />}
      {isCdrTab && (
        <>
          <div className="filter-row">
            <select className="control-select" defaultValue="today" aria-label="Range"><option value="today">Today</option></select>
            <span className="date-pill">{today()}, 00:00:00 &nbsp;-&nbsp; {today()}, 23:59:59</span>
          </div>
          <div className="filter-row diagnostic-filters">
            <select className="control-select" defaultValue="dallas" aria-label="Switch"><option value="dallas">dallas</option></select>
            <select className="control-select" defaultValue="" aria-label="Trunk group"><option value="">Select Trunk Group</option></select>
            <input className="control-input" placeholder="ANI" aria-label="ANI" />
            <input className="control-input" placeholder="Dialed Number" aria-label="Dialed Number" />
          </div>
          <div className="tabs">
            {STATUS_TABS.map((item) => (
              <button key={item} className={`tab ${item === status ? 'tab-active' : ''}`} onClick={() => setStatus(item)}>{item}</button>
            ))}
          </div>
          <section className="panel table-panel">
            <div className="table-toolbar">
              <input className="search-input" placeholder="Search..." value={q} onChange={(event) => setQ(event.target.value)} />
              <div className="toolbar-actions">
                <button className="btn btn-primary btn-sm" onClick={generate}>Generate</button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>× Reset</button>
                <button className="btn btn-ghost btn-sm" disabled={!filtered?.length}>Export</button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="report-table">
                <thead><tr><th>Date + Time</th><th>ANI</th><th>DNIS</th><th>LRN</th><th>Release Code</th><th>Release Cause</th><th className="num">Duration</th><th>Relationship / Trunk</th><th>Orig Juris</th><th className="num">Rate</th></tr></thead>
                <tbody>{filtered?.map((row, index) => (
                  <tr key={`${row.dateTime}-${index}`}>
                    <td>{new Date(row.dateTime).toISOString().replace('T', ' ').slice(0, 19)}</td><td>{row.ani}</td><td>{row.dnis}</td><td>{row.lrn}</td><td>{row.releaseCode}</td><td>{row.releaseCause}</td><td className="num">{row.duration}</td><td>{row.relationshipTrunk}</td><td>{row.origJuris}</td><td className="num">{row.rate.toFixed(5)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {generated && rows === null && !error && <div className="chart-skeleton compact-skeleton" />}
            {(!generated || (filtered !== undefined && filtered.length === 0)) && (
              <EmptyState title="No record found" description={!generated ? 'Press Generate to run the report.' : 'No calls matched the selected filters.'} />
            )}
          </section>
        </>
      )}
    </Shell>
  );
}

function LiveCallsPanel({ rows, query, setQuery, refresh }: { rows: LiveCallRow[] | null; query: string; setQuery: (value: string) => void; refresh: () => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <input className="search-input" placeholder="Search..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="btn btn-ghost btn-sm" onClick={refresh}>Refresh</button>
      </div>
      <div className="table-scroll"><table className="report-table"><thead><tr><th>Relationship</th><th>Trunk Group</th><th>Start</th><th>ANI</th><th>DNIS</th><th className="num">Duration</th></tr></thead><tbody>{filtered?.map((row, index) => <tr key={`${row.start}-${index}`}><td>{row.relationship}</td><td>{row.trunkGroup}</td><td>{row.start}</td><td>{row.ani}</td><td>{row.dnis}</td><td className="num">{row.duration}</td></tr>)}</tbody></table></div>
      {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No live calls" description="Active calls will appear here automatically." />}
    </section>
  );
}

function CdrExportsPanel({ rows, query, setQuery }: { rows: CdrExportRow[] | null; query: string; setQuery: (value: string) => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return (
    <section className="panel table-panel">
      <div className="table-toolbar"><input className="search-input" placeholder="Search..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <div className="table-scroll"><table className="report-table"><thead><tr><th>Export Name</th><th>Export Date</th><th>Status</th><th>Period</th><th>Export User</th><th>Action</th></tr></thead><tbody>{filtered?.map((row) => <tr key={`${row.exportName}-${row.exportDate}`}><td>{row.exportName}</td><td>{row.exportDate}</td><td><span className="tag tag-ok">{row.status}</span></td><td>{row.period}</td><td>{row.exportUser}</td><td><button className="btn btn-link">Download</button></td></tr>)}</tbody></table></div>
      {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No CDR exports" description="Generated exports will appear here." />}
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><BriefcaseIcon /><div className="empty-title">{title}</div><div className="empty-sub">{description}</div></div>;
}

function BriefcaseIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#aab2bd" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18" />
    </svg>
  );
}
