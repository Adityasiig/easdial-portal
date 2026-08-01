import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type CdrExportRow,
  type CdrFilterOptions,
  type CdrRow,
  type CdrStatus,
  type Direction,
  type LiveCallRow,
} from '../api/client';
import { Shell } from '../components/Shell';

const TOP_TABS = ['Termination', 'Origination', 'Live Calls', 'CDR Export'] as const;
type TopTab = (typeof TOP_TABS)[number];
type RangePreset = 'today' | 'last-hour' | 'last-6-hours' | 'last-24-hours' | 'custom';

const STATUS_TABS: Array<{ label: string; value: CdrStatus }> = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
];

const utcInputValue = (date: Date) => date.toISOString().slice(0, 16);
const toIso = (value: string) => new Date(`${value}:00Z`).toISOString();

function rangeBounds(preset: Exclude<RangePreset, 'custom'>): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (preset === 'today') start.setUTCHours(0, 0, 0, 0);
  if (preset === 'last-hour') start.setUTCHours(start.getUTCHours() - 1);
  if (preset === 'last-6-hours') start.setUTCHours(start.getUTCHours() - 6);
  if (preset === 'last-24-hours') start.setUTCHours(start.getUTCHours() - 24);
  return { start: utcInputValue(start), end: utcInputValue(end) };
}

function formatUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '—';
  return parsed.toISOString().replace('T', ' ').slice(0, 19);
}

export function CallDiagnostic() {
  const initialRange = rangeBounds('today');
  const [top, setTop] = useState<TopTab>('Termination');
  const [status, setStatus] = useState<CdrStatus>('all');
  const [range, setRange] = useState<RangePreset>('today');
  const [startTime, setStartTime] = useState(initialRange.start);
  const [endTime, setEndTime] = useState(initialRange.end);
  const [filters, setFilters] = useState<CdrFilterOptions | null>(null);
  const [location, setLocation] = useState('');
  const [trunkGroupId, setTrunkGroupId] = useState('');
  const [ani, setAni] = useState('');
  const [dnis, setDnis] = useState('');
  const [rows, setRows] = useState<CdrRow[] | null>(null);
  const [liveRows, setLiveRows] = useState<LiveCallRow[] | null>(null);
  const [exportRows, setExportRows] = useState<CdrExportRow[] | null>(null);
  const [generated, setGenerated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const direction: Direction = top === 'Origination' ? 'origination' : 'termination';
  const isCdrTab = top === 'Termination' || top === 'Origination';

  useEffect(() => {
    if (!isCdrTab) return;
    let active = true;
    setFilters(null);
    setError(null);
    api.cdrFilters(direction).then((options) => {
      if (!active) return;
      setFilters(options);
      setLocation((current) => current && options.locations.includes(current) ? current : (options.locations[0] ?? ''));
      setTrunkGroupId('');
    }).catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [direction, isCdrTab]);

  useEffect(() => {
    setQ('');
    setError(null);
    if (top === 'Live Calls') {
      let active = true;
      const load = () => api.liveCalls().then((data) => active && setLiveRows(data)).catch((err) => active && setError(err.message));
      setLiveRows(null);
      load();
      const refreshTimer = window.setInterval(load, 15_000);
      return () => { active = false; window.clearInterval(refreshTimer); };
    }
    if (top === 'CDR Export') {
      setExportRows(null);
      api.cdrExports().then(setExportRows).catch((err) => setError(err.message));
      return;
    }
    setRows(null);
    setGenerated(false);
  }, [top]);

  const changeRange = (next: RangePreset) => {
    setRange(next);
    if (next !== 'custom') {
      const bounds = rangeBounds(next);
      setStartTime(bounds.start);
      setEndTime(bounds.end);
    }
  };

  const runReport = async (nextStatus: CdrStatus = status) => {
    setError(null);
    if (!startTime || !endTime || new Date(`${endTime}:00Z`) <= new Date(`${startTime}:00Z`)) {
      setError('Choose a valid UTC date range before generating the report.');
      return;
    }
    const selectedTrunk = filters?.trunkGroups.find((group) => group.id === trunkGroupId);
    setRows(null);
    setGenerated(true);
    setBusy(true);
    try {
      const data = await api.cdrs({
        direction,
        startTime: toIso(startTime),
        endTime: toIso(endTime),
        location: location || undefined,
        trunkGroupId: trunkGroupId || undefined,
        trunkGroupLabel: selectedTrunk?.label,
        ani: ani.trim() || undefined,
        dnis: dnis.trim() || undefined,
        status: nextStatus,
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate the CDR report.');
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  const chooseStatus = (next: CdrStatus) => {
    setStatus(next);
    if (generated) void runReport(next);
  };

  const reset = () => {
    const bounds = rangeBounds('today');
    setRange('today');
    setStartTime(bounds.start);
    setEndTime(bounds.end);
    setLocation(filters?.locations[0] ?? '');
    setTrunkGroupId('');
    setAni('');
    setDnis('');
    setRows(null);
    setGenerated(false);
    setQ('');
    setStatus('all');
    setError(null);
  };

  const filtered = useMemo(() => rows?.filter((row) => {
    const term = q.trim().toLowerCase();
    return !term || [row.ani, row.dnis, row.lrn, row.releaseCode, row.releaseCause, row.relationshipTrunk]
      .some((value) => value.toLowerCase().includes(term));
  }), [q, rows]);

  const stats = useMemo(() => {
    const source = rows ?? [];
    const completed = source.filter((row) => row.duration > 0);
    const totalSeconds = source.reduce((sum, row) => sum + row.duration, 0);
    return {
      total: source.length,
      completed: completed.length,
      failed: source.length - completed.length,
      avgDuration: completed.length ? Math.round(totalSeconds / completed.length) : 0,
    };
  }, [rows]);

  const exportCsv = () => {
    if (!filtered?.length) return;
    const headers = ['Date Time', 'ANI', 'DNIS', 'LRN', 'Release Code', 'Release Cause', 'Duration', 'Relationship / Trunk', 'Orig Juris', 'Rate'];
    const values = filtered.map((row) => [row.dateTime, row.ani, row.dnis, row.lrn, row.releaseCode, row.releaseCause, row.duration, row.relationshipTrunk, row.origJuris, row.rate]);
    const csv = [headers, ...values].map((record) => record.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `easdial-cdr-${direction}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell title="Call Diagnostic">
      <div className="tabs page-tabs diagnostic-main-tabs">
        {TOP_TABS.map((tab) => (
          <button key={tab} className={`tab ${tab === top ? 'tab-active' : ''}`} onClick={() => setTop(tab)}>{tab}</button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {top === 'Live Calls' && <LiveCallsPanel rows={liveRows} query={q} setQuery={setQ} refresh={() => {
        setLiveRows(null);
        api.liveCalls().then(setLiveRows).catch((err) => setError(err.message));
      }} />}
      {top === 'CDR Export' && <CdrExportsPanel rows={exportRows} query={q} setQuery={setQ} />}

      {isCdrTab && (
        <div className="diagnostic-workspace">
          <section className="diagnostic-filter-panel" aria-label="CDR report filters">
            <div className="diagnostic-filter-head">
              <div><h2>Report filters</h2><p>All dates and times use GMT.</p></div>
              <button className="btn btn-link" onClick={reset}>Clear filters</button>
            </div>
            <div className="diagnostic-grid diagnostic-grid-time">
              <label className="field"><span>Time range</span><select className="control-select" value={range} onChange={(event) => changeRange(event.target.value as RangePreset)}>
                <option value="today">Today</option><option value="last-hour">Last hour</option><option value="last-6-hours">Last 6 hours</option><option value="last-24-hours">Last 24 hours</option><option value="custom">Custom</option>
              </select></label>
              <label className="field"><span>From</span><input className="control-input" type="datetime-local" value={startTime} onChange={(event) => { setRange('custom'); setStartTime(event.target.value); }} /></label>
              <label className="field"><span>To</span><input className="control-input" type="datetime-local" value={endTime} onChange={(event) => { setRange('custom'); setEndTime(event.target.value); }} /></label>
            </div>
            <div className="diagnostic-grid">
              <label className="field"><span>Switch location</span><select className="control-select" value={location} onChange={(event) => setLocation(event.target.value)} disabled={!filters}>
                {!filters && <option>Loading…</option>}
                {filters?.locations.length === 0 && <option value="">All locations</option>}
                {filters?.locations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></label>
              <label className="field"><span>Trunk group</span><select className="control-select" value={trunkGroupId} onChange={(event) => setTrunkGroupId(event.target.value)} disabled={!filters}>
                <option value="">All trunk groups</option>
                {filters?.trunkGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
              </select></label>
              <label className="field"><span>ANI</span><input className="control-input" inputMode="tel" placeholder="Calling number" value={ani} onChange={(event) => setAni(event.target.value)} /></label>
              <label className="field"><span>DNIS</span><input className="control-input" inputMode="tel" placeholder="Dialed number" value={dnis} onChange={(event) => setDnis(event.target.value)} /></label>
            </div>
          </section>

          <div className="diagnostic-report-tabs" role="tablist" aria-label="Call status">
            {STATUS_TABS.map((item) => <button key={item.value} role="tab" aria-selected={item.value === status} className={item.value === status ? 'active' : ''} onClick={() => chooseStatus(item.value)}>{item.label}</button>)}
          </div>

          <section className="panel table-panel diagnostic-results">
            <div className="diagnostic-stats" aria-label="CDR analysis summary">
              <Stat label="Records" value={stats.total.toLocaleString()} />
              <Stat label="Completed" value={stats.completed.toLocaleString()} tone="success" />
              <Stat label="Failed" value={stats.failed.toLocaleString()} tone="danger" />
              <Stat label="Average duration" value={`${stats.avgDuration}s`} />
            </div>
            <div className="table-toolbar">
              <input className="search-input" aria-label="Search report results" placeholder="Search report results" value={q} onChange={(event) => setQ(event.target.value)} />
              <div className="toolbar-actions">
                <button className="btn btn-primary btn-sm" onClick={() => void runReport()} disabled={busy}>{busy ? 'Generating…' : 'Generate report'}</button>
                <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!filtered?.length}>Export CSV</button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="report-table cdr-table">
                <thead><tr><th>Date + time</th><th>ANI</th><th>DNIS</th><th>LRN</th><th>Release</th><th>Cause</th><th className="num">Duration</th><th>Relationship / trunk</th><th>Juris</th><th className="num">Rate</th></tr></thead>
                <tbody>{filtered?.map((row, index) => <tr key={`${row.dateTime}-${row.ani}-${index}`}>
                  <td>{formatUtc(row.dateTime)}</td><td>{row.ani || '—'}</td><td>{row.dnis || '—'}</td><td>{row.lrn || '—'}</td>
                  <td><span className={`call-status ${row.duration > 0 ? 'completed' : 'failed'}`}>{row.releaseCode || '—'}</span></td>
                  <td>{row.releaseCause || '—'}</td><td className="num">{row.duration}s</td><td>{row.relationshipTrunk || '—'}</td><td>{row.origJuris || '—'}</td><td className="num">{row.rate.toFixed(5)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            {generated && rows === null && !error && <div className="chart-skeleton compact-skeleton" />}
            {(!generated || (filtered !== undefined && filtered.length === 0)) && <EmptyState title={generated ? 'No calls matched' : 'Ready to analyze calls'} description={generated ? 'Adjust the filters and generate the report again.' : 'Choose your filters, then select Generate report.'} />}
          </section>
        </div>
      )}
    </Shell>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: '' | 'success' | 'danger' }) {
  return <div className={`diagnostic-stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function LiveCallsPanel({ rows, query, setQuery, refresh }: { rows: LiveCallRow[] | null; query: string; setQuery: (value: string) => void; refresh: () => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return <section className="panel table-panel diagnostic-results">
    <div className="section-head"><div><h2 className="section-title">Live calls</h2><p className="section-description">Automatically refreshes every 15 seconds.</p></div><button className="btn btn-ghost btn-sm" onClick={refresh}>Refresh now</button></div>
    <div className="table-toolbar"><input className="search-input" placeholder="Search active calls" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="table-scroll"><table className="report-table"><thead><tr><th>Relationship</th><th>Trunk group</th><th>Start</th><th>ANI</th><th>DNIS</th><th className="num">Duration</th></tr></thead><tbody>{filtered?.map((row, index) => <tr key={`${row.start}-${index}`}><td>{row.relationship}</td><td>{row.trunkGroup}</td><td>{formatUtc(row.start)}</td><td>{row.ani}</td><td>{row.dnis}</td><td className="num">{row.duration}s</td></tr>)}</tbody></table></div>
    {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No live calls" description="Active calls will appear here automatically." />}
  </section>;
}

function CdrExportsPanel({ rows, query, setQuery }: { rows: CdrExportRow[] | null; query: string; setQuery: (value: string) => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return <section className="panel table-panel diagnostic-results">
    <div className="section-head"><div><h2 className="section-title">CDR exports</h2><p className="section-description">Previously generated report files.</p></div></div>
    <div className="table-toolbar"><input className="search-input" placeholder="Search export history" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="table-scroll"><table className="report-table"><thead><tr><th>Export name</th><th>Export date</th><th>Status</th><th>Period</th><th>Export user</th></tr></thead><tbody>{filtered?.map((row) => <tr key={`${row.exportName}-${row.exportDate}`}><td>{row.exportName}</td><td>{formatUtc(row.exportDate)}</td><td><span className="tag tag-ok">{row.status}</span></td><td>{row.period}</td><td>{row.exportUser}</td></tr>)}</tbody></table></div>
    {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No CDR exports" description="Generated export files will appear here." />}
  </section>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-glyph" aria-hidden /><div className="empty-title">{title}</div><div className="empty-sub">{description}</div></div>;
}
