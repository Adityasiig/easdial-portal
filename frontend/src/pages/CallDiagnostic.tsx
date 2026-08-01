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
import { DateRangePicker } from '../components/DateRangePicker';
import { Shell } from '../components/Shell';

const TOP_TABS = ['Termination', 'Origination', 'Live Calls', 'CDR Export'] as const;
type TopTab = (typeof TOP_TABS)[number];
type RangePreset = 'last-10-min' | 'last-hour' | 'last-6-hours' | 'last-12-hours' | 'today' | 'custom';

const STATUS_TABS: Array<{ label: string; value: CdrStatus }> = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
];

const utcInputValue = (date: Date) => date.toISOString().slice(0, 19);
const toIso = (value: string) => new Date(`${value}${value.length === 16 ? ':00' : ''}Z`).toISOString();

function rangeBounds(preset: Exclude<RangePreset, 'custom'>): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (preset === 'today') start.setUTCHours(0, 0, 0, 0);
  if (preset === 'last-10-min') start.setUTCMinutes(start.getUTCMinutes() - 10);
  if (preset === 'last-hour') start.setUTCHours(start.getUTCHours() - 1);
  if (preset === 'last-6-hours') start.setUTCHours(start.getUTCHours() - 6);
  if (preset === 'last-12-hours') start.setUTCHours(start.getUTCHours() - 12);
  return { start: utcInputValue(start), end: utcInputValue(end) };
}

function formatUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '—';
  return parsed.toISOString().replace('T', ' ').slice(0, 19);
}

export function CallDiagnostic() {
  const initialRange = rangeBounds('last-10-min');
  const [top, setTop] = useState<TopTab>('Termination');
  const [status, setStatus] = useState<CdrStatus>('all');
  const [range, setRange] = useState<RangePreset>('last-10-min');
  const [startTime, setStartTime] = useState(initialRange.start);
  const [endTime, setEndTime] = useState(initialRange.end);
  const [filters, setFilters] = useState<CdrFilterOptions | null>(null);
  const [location, setLocation] = useState('');
  const [trunkGroupId, setTrunkGroupId] = useState('');
  const [ani, setAni] = useState('');
  const [dnis, setDnis] = useState('');
  const [releaseCode, setReleaseCode] = useState('');
  const [callId, setCallId] = useState('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [includeBLeg, setIncludeBLeg] = useState(false);
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
      void load();
      const timer = window.setInterval(load, 15_000);
      return () => { active = false; window.clearInterval(timer); };
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
    if (!startTime || !endTime || parseUtc(endTime) <= parseUtc(startTime)) {
      setError('Choose a valid GMT date range before generating the report.');
      return;
    }
    if (minDuration && maxDuration && Number(maxDuration) < Number(minDuration)) {
      setError('Maximum duration must be greater than or equal to minimum duration.');
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
        releaseCode: releaseCode.trim() || undefined,
        callId: callId.trim() || undefined,
        minDuration: minDuration === '' ? undefined : Number(minDuration),
        maxDuration: maxDuration === '' ? undefined : Number(maxDuration),
        includeBLeg,
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
    const bounds = rangeBounds('last-10-min');
    setRange('last-10-min');
    setStartTime(bounds.start);
    setEndTime(bounds.end);
    setLocation(filters?.locations[0] ?? '');
    setTrunkGroupId('');
    setAni('');
    setDnis('');
    setReleaseCode('');
    setCallId('');
    setMinDuration('');
    setMaxDuration('');
    setIncludeBLeg(false);
    setRows(null);
    setGenerated(false);
    setQ('');
    setStatus('all');
    setError(null);
  };

  const filtered = useMemo(() => rows?.filter((row) => {
    const term = q.trim().toLowerCase();
    return !term || [row.ani, row.dnis, row.lrn, row.releaseCode, row.releaseCause, row.relationshipTrunk].some((value) => value.toLowerCase().includes(term));
  }), [q, rows]);

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
    <Shell title="CDR Diagnostic">
      <div className="tabs page-tabs diagnostic-main-tabs">
        {TOP_TABS.map((tab) => <button key={tab} className={`tab ${tab === top ? 'tab-active' : ''}`} onClick={() => setTop(tab)}>{tab}</button>)}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {top === 'Live Calls' && <LiveCallsPanel rows={liveRows} query={q} setQuery={setQ} refresh={() => {
        setLiveRows(null);
        api.liveCalls().then(setLiveRows).catch((err) => setError(err.message));
      }} />}
      {top === 'CDR Export' && <CdrExportsPanel rows={exportRows} query={q} setQuery={setQ} />}

      {isCdrTab && (
        <div className="diagnostic-workspace">
          <section className="peeredge-filter-area" aria-label="CDR report filters">
            <div className="diagnostic-time-row">
              <select className="control-select preset-select" value={range} aria-label="Time range preset" onChange={(event) => changeRange(event.target.value as RangePreset)}>
                <option value="last-10-min">Last 10 Min</option>
                <option value="last-hour">Last Hour</option>
                <option value="last-6-hours">Last 6 Hours</option>
                <option value="last-12-hours">Last 12 Hours</option>
                <option value="today">Today</option>
                <option value="custom">Custom</option>
              </select>
              <DateRangePicker start={startTime} end={endTime} onChange={(start, end) => { setRange('custom'); setStartTime(start); setEndTime(end); }} />
            </div>

            <div className="peeredge-filter-grid filter-grid-primary">
              <select className="control-select" aria-label="Switch location" value={location} onChange={(event) => setLocation(event.target.value)} disabled={!filters}>
                {!filters && <option>Loading…</option>}
                {filters?.locations.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="control-select" aria-label="Trunk group" value={trunkGroupId} onChange={(event) => setTrunkGroupId(event.target.value)} disabled={!filters}>
                <option value="">All Trunk Groups</option>
                {filters?.trunkGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
              </select>
              <input className="control-input" placeholder="Release Code" aria-label="Release code" value={releaseCode} onChange={(event) => setReleaseCode(event.target.value)} />
              <input className="control-input" inputMode="tel" placeholder="ANI" aria-label="ANI" value={ani} onChange={(event) => setAni(event.target.value)} />
              <input className="control-input" inputMode="tel" placeholder="DNIS" aria-label="DNIS" value={dnis} onChange={(event) => setDnis(event.target.value)} />
            </div>
            <div className="peeredge-filter-grid filter-grid-secondary">
              <input className="control-input" placeholder="SIP Call ID" aria-label="SIP Call ID" value={callId} onChange={(event) => setCallId(event.target.value)} />
              <input className="control-input" type="number" min="0" placeholder="Minimum Duration" aria-label="Minimum duration" value={minDuration} onChange={(event) => setMinDuration(event.target.value)} />
              <input className="control-input" type="number" min="0" placeholder="Maximum Duration" aria-label="Maximum duration" value={maxDuration} onChange={(event) => setMaxDuration(event.target.value)} />
              <label className="include-leg"><input type="checkbox" checked={includeBLeg} onChange={(event) => setIncludeBLeg(event.target.checked)} /><span>Include B Leg</span></label>
            </div>
          </section>

          <div className="diagnostic-report-tabs" role="tablist" aria-label="Call status">
            {STATUS_TABS.map((item) => <button key={item.value} role="tab" aria-selected={item.value === status} className={item.value === status ? 'active' : ''} onClick={() => chooseStatus(item.value)}>{item.label}{item.value === 'all' && rows && <span className="result-count">{rows.length}</span>}</button>)}
          </div>

          <section className="panel table-panel diagnostic-results">
            <div className="table-toolbar">
              <input className="search-input" aria-label="Search report results" placeholder="Search…" value={q} onChange={(event) => setQ(event.target.value)} />
              <div className="toolbar-actions">
                <button className="btn btn-primary btn-sm" onClick={() => void runReport()} disabled={busy}><RefreshIcon />{busy ? 'Generating…' : 'Generate'}</button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>×&nbsp; Reset</button>
                <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!filtered?.length}>Export</button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="report-table cdr-table">
                <thead><tr><th>Date Time</th><th>ANI</th><th>DNIS</th><th>LRN</th><th>Release Code</th><th>Release Cause</th><th className="num">Duration</th><th>Customer - Trunk</th><th>Orig Juris</th><th className="num">Rate</th></tr></thead>
                <tbody>{filtered?.map((row, index) => <tr key={`${row.dateTime}-${row.ani}-${index}`}>
                  <td>{formatUtc(row.dateTime)}</td><td>{row.ani || '—'}</td><td>{row.dnis || '—'}</td><td>{row.lrn || '—'}</td>
                  <td>{row.releaseCode || '—'}</td><td>{row.releaseCause || '—'}</td><td className="num">{row.duration}</td><td>{row.relationshipTrunk || '—'}</td><td>{row.origJuris || '—'}</td><td className="num">{row.rate.toFixed(5)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            {generated && rows === null && !error && <div className="chart-skeleton compact-skeleton" />}
            {(!generated || (filtered !== undefined && filtered.length === 0)) && <EmptyState title={generated ? 'No calls matched' : 'Ready to generate'} description={generated ? 'Adjust the filters and generate the report again.' : 'Choose the date and filters, then select Generate.'} />}
          </section>
        </div>
      )}
    </Shell>
  );
}

const parseUtc = (value: string) => new Date(`${value}${value.length === 16 ? ':00' : ''}Z`);

function RefreshIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 11a8 8 0 0 0-14.7-4M4 4v5h5M4 13a8 8 0 0 0 14.7 4M20 20v-5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function LiveCallsPanel({ rows, query, setQuery, refresh }: { rows: LiveCallRow[] | null; query: string; setQuery: (value: string) => void; refresh: () => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return <section className="panel table-panel diagnostic-results">
    <div className="table-toolbar"><input className="search-input" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="toolbar-actions"><button className="btn btn-ghost btn-sm" onClick={refresh}><RefreshIcon />Refresh</button></div></div>
    <div className="table-scroll"><table className="report-table"><thead><tr><th>Relationship</th><th>Trunk Group</th><th>Start</th><th>ANI</th><th>DNIS</th><th className="num">Duration</th></tr></thead><tbody>{filtered?.map((row, index) => <tr key={`${row.start}-${index}`}><td>{row.relationship}</td><td>{row.trunkGroup}</td><td>{formatUtc(row.start)}</td><td>{row.ani}</td><td>{row.dnis}</td><td className="num">{row.duration}s</td></tr>)}</tbody></table></div>
    {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No live calls" description="Active calls refresh automatically every 15 seconds." />}
  </section>;
}

function CdrExportsPanel({ rows, query, setQuery }: { rows: CdrExportRow[] | null; query: string; setQuery: (value: string) => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return <section className="panel table-panel diagnostic-results">
    <div className="table-toolbar"><input className="search-input" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="table-scroll"><table className="report-table"><thead><tr><th>Export Name</th><th>Export Date</th><th>Status</th><th>Period</th><th>Export User</th></tr></thead><tbody>{filtered?.map((row) => <tr key={`${row.exportName}-${row.exportDate}`}><td>{row.exportName}</td><td>{formatUtc(row.exportDate)}</td><td><span className="tag tag-ok">{row.status}</span></td><td>{row.period}</td><td>{row.exportUser}</td></tr>)}</tbody></table></div>
    {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No CDR exports" description="Scoped export history will appear here when available." />}
  </section>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-glyph" aria-hidden /><div className="empty-title">{title}</div><div className="empty-sub">{description}</div></div>;
}
