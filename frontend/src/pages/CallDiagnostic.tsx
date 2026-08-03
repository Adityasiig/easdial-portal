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
const PAGE_SIZE = 25;

const STATUS_TABS: Array<{ label: string; value: CdrStatus }> = [
  { label: 'All calls', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
];

const utcInputValue = (date: Date) => date.toISOString().slice(0, 19);
const parseUtc = (value: string) => new Date(`${value}${value.length === 16 ? ':00' : ''}Z`);
const toIso = (value: string) => parseUtc(value).toISOString();

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
  const [filterBusy, setFilterBusy] = useState(false);
  const [location, setLocation] = useState('');
  const [customerTrunkGroupId, setCustomerTrunkGroupId] = useState('');
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
  const [page, setPage] = useState(1);

  const direction: Direction = top === 'Origination' ? 'origination' : 'termination';
  const isCdrTab = top === 'Termination' || top === 'Origination';

  useEffect(() => {
    if (!isCdrTab) return;
    let active = true;
    setFilters(null);
    setError(null);
    api.cdrFilters(direction).then(async (options) => {
      if (!active) return;
      const nextLocation = location && options.locations.includes(location) ? location : (options.locations[0] ?? '');
      const scoped = nextLocation ? await api.cdrFilters(direction, nextLocation) : options;
      if (!active) return;
      setFilters({ ...scoped, locations: options.locations });
      setLocation(nextLocation);
      setCustomerTrunkGroupId('');
    }).catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, [direction, isCdrTab]);

  const changeLocation = async (nextLocation: string) => {
    setLocation(nextLocation);
    setCustomerTrunkGroupId('');
    setFilterBusy(true);
    try {
      const scoped = await api.cdrFilters(direction, nextLocation);
      setFilters((current) => ({ ...scoped, locations: current?.locations ?? scoped.locations }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trunk groups for this location.');
    } finally {
      setFilterBusy(false);
    }
  };

  useEffect(() => {
    setQ('');
    setPage(1);
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
    const customer = filters?.customerTrunkGroups.find((group) => group.id === customerTrunkGroupId);
    setRows(null);
    setGenerated(true);
    setBusy(true);
    setPage(1);
    try {
      const data = await api.cdrs({
        direction,
        startTime: toIso(startTime),
        endTime: toIso(endTime),
        location: location || undefined,
        customerTrunkGroupId: customerTrunkGroupId || undefined,
        customerTrunkGroupLabel: customer?.label,
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
    setCustomerTrunkGroupId('');
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
    setPage(1);
    setStatus('all');
    setError(null);
  };

  const filtered = useMemo(() => rows?.filter((row) => {
    const term = q.trim().toLowerCase();
    return !term || [row.ani, row.dnis, row.lrn, row.releaseCode, row.releaseCause, row.customerTrunk]
      .some((value) => value.toLowerCase().includes(term));
  }), [q, rows]);

  useEffect(() => { setPage(1); }, [q]);
  const pageCount = Math.max(1, Math.ceil((filtered?.length ?? 0) / PAGE_SIZE));
  const visibleRows = filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    if (!filtered?.length) return;
    const headers = ['Date Time', 'ANI', 'DNIS', 'LRN', 'Release Code', 'Release Cause', 'Duration', 'Customer Trunk', 'Orig Juris', 'Rate'];
    const values = filtered.map((row) => [row.dateTime, row.ani, row.dnis, row.lrn, row.releaseCode, row.releaseCause, row.duration, row.customerTrunk, row.origJuris, row.rate]);
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
      <div className="tabs page-tabs diagnostic-main-tabs" role="tablist" aria-label="CDR mode">
        {TOP_TABS.map((tab) => <button key={tab} role="tab" aria-selected={tab === top} className={`tab ${tab === top ? 'tab-active' : ''}`} onClick={() => setTop(tab)}>{tab}</button>)}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {top === 'Live Calls' && <LiveCallsPanel rows={liveRows} query={q} setQuery={setQ} refresh={() => {
        setLiveRows(null);
        api.liveCalls().then(setLiveRows).catch((err) => setError(err.message));
      }} />}
      {top === 'CDR Export' && <CdrExportsPanel rows={exportRows} query={q} setQuery={setQ} />}

      {isCdrTab && (
        <div className="cdr-workspace">
          <section className="panel cdr-query-panel" aria-label="CDR report filters">
            <div className="cdr-panel-heading">
              <div><h2>Search call records</h2><p>Build a scoped report using GMT. Customer and vendor trunks are filtered independently.</p></div>
              <span className="scope-chip">Customer scoped</span>
            </div>

            <div className="cdr-range-row">
              <Field label="Time range">
                <select className="control-select" value={range} aria-label="Time range preset" onChange={(event) => changeRange(event.target.value as RangePreset)}>
                  <option value="last-10-min">Last 10 minutes</option>
                  <option value="last-hour">Last hour</option>
                  <option value="last-6-hours">Last 6 hours</option>
                  <option value="last-12-hours">Last 12 hours</option>
                  <option value="today">Today</option>
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <Field label="Reporting period" className="cdr-period-field">
                <DateRangePicker start={startTime} end={endTime} onChange={(start, end) => { setRange('custom'); setStartTime(start); setEndTime(end); }} />
              </Field>
            </div>

            <div className="cdr-primary-filters cdr-compact-filters">
              <Field label="Switch location" className="cdr-compact-field">
                <select className="control-select" aria-label="Switch location" value={location} onChange={(event) => void changeLocation(event.target.value)} disabled={!filters || filterBusy}>
                  {!filters && <option>Loading…</option>}
                  {filters?.locations.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Customer trunk" className="cdr-compact-field">
                <select className="control-select" aria-label="Customer trunk" value={customerTrunkGroupId} onChange={(event) => setCustomerTrunkGroupId(event.target.value)} disabled={!filters || filterBusy}>
                  <option value="">All customer trunks</option>
                  {filters?.customerTrunkGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                </select>
              </Field>
              <Field label="ANI" className="cdr-compact-field"><input className="control-input" aria-label="ANI" inputMode="tel" placeholder="ANI" value={ani} onChange={(event) => setAni(event.target.value)} /></Field>
              <Field label="DNIS" className="cdr-compact-field"><input className="control-input" aria-label="DNIS" inputMode="tel" placeholder="Dialed number" value={dnis} onChange={(event) => setDnis(event.target.value)} /></Field>
            </div>

            <details className="cdr-advanced" open>
              <summary>Advanced filters</summary>
              <div className="cdr-advanced-grid">
                <Field label="SIP Call ID"><input className="control-input" placeholder="Exact call ID" value={callId} onChange={(event) => setCallId(event.target.value)} /></Field>
                <Field label="Release code"><input className="control-input" placeholder="e.g. 16" value={releaseCode} onChange={(event) => setReleaseCode(event.target.value)} /></Field>
                <Field label="Minimum duration"><input className="control-input" type="number" min="0" placeholder="Seconds" value={minDuration} onChange={(event) => setMinDuration(event.target.value)} /></Field>
                <Field label="Maximum duration"><input className="control-input" type="number" min="0" placeholder="Seconds" value={maxDuration} onChange={(event) => setMaxDuration(event.target.value)} /></Field>
              </div>
              <label className="include-leg"><input type="checkbox" checked={includeBLeg} onChange={(event) => setIncludeBLeg(event.target.checked)} /><span>Include B-leg records</span></label>
            </details>

            <div className="cdr-query-footer">
              <div className="cdr-status-tabs" role="tablist" aria-label="Call status">
                {STATUS_TABS.map((item) => <button key={item.value} type="button" role="tab" aria-selected={item.value === status} className={item.value === status ? 'active' : ''} onClick={() => chooseStatus(item.value)}>{item.label}</button>)}
              </div>
              <div className="toolbar-actions">
                <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Reset</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => void runReport()} disabled={busy}><RefreshIcon />{busy ? 'Generating…' : 'Generate report'}</button>
              </div>
            </div>
          </section>

          <section className="panel table-panel cdr-results-panel">
            <div className="cdr-results-head">
              <div><h2>Call records</h2><p>{generated ? `${filtered?.length ?? 0} matching records` : 'Generate a report to view call details'}</p></div>
              <div className="cdr-results-tools">
                <input className="search-input" aria-label="Search report results" placeholder="Search results" value={q} onChange={(event) => setQ(event.target.value)} />
                <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!filtered?.length}>Export CSV</button>
              </div>
            </div>
            <div className="table-scroll cdr-table-scroll">
              <table className="report-table cdr-table">
                <thead><tr><th>Date / Time</th><th>ANI</th><th>DNIS</th><th>LRN</th><th>Release</th><th>Cause</th><th className="num">Duration</th><th>Customer trunk</th><th>Juris</th><th className="num">Rate</th></tr></thead>
                <tbody>{visibleRows?.map((row, index) => <tr key={`${row.dateTime}-${row.ani}-${index}`}>
                  <td className="date-cell">{formatUtc(row.dateTime)}</td><td className="mono-cell">{row.ani || '—'}</td><td className="mono-cell">{row.dnis || '—'}</td><td className="mono-cell">{row.lrn || '—'}</td>
                  <td><span className={`release-pill ${row.duration > 0 ? 'ok' : 'failed'}`}>{row.releaseCode || '—'}</span></td><td>{row.releaseCause || '—'}</td><td className="num">{formatDuration(row.duration)}</td>
                  <td><TrunkCell value={row.customerTrunk} /></td><td>{row.origJuris || '—'}</td><td className="num">{row.rate.toFixed(5)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            {generated && rows === null && !error && <div className="chart-skeleton compact-skeleton" />}
            {(!generated || (filtered !== undefined && filtered.length === 0)) && <EmptyState title={generated ? 'No calls matched' : 'No report generated'} description={generated ? 'Change one or more filters and generate the report again.' : 'Choose the required filters above and generate a scoped CDR report.'} />}
            {Boolean(filtered?.length) && <div className="cdr-pagination"><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered?.length ?? 0)} of {filtered?.length}</span><div><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>}
          </section>
        </div>
      )}
    </Shell>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`cdr-field ${className}`}><span>{label}</span>{children}</label>;
}

function TrunkCell({ value }: { value: string }) {
  const [relationship, ...rest] = value.split(' / ');
  return <span className="trunk-cell"><span>{relationship || '—'}</span>{rest.length > 0 && <small>{rest.join(' / ')}</small>}</span>;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function RefreshIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 11a8 8 0 0 0-14.7-4M4 4v5h5M4 13a8 8 0 0 0 14.7 4M20 20v-5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function LiveCallsPanel({ rows, query, setQuery, refresh }: { rows: LiveCallRow[] | null; query: string; setQuery: (value: string) => void; refresh: () => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return <section className="panel table-panel cdr-results-panel">
    <div className="cdr-results-head"><div><h2>Live calls</h2><p>Scoped to this customer and refreshed every 15 seconds</p></div><div className="cdr-results-tools"><input className="search-input" placeholder="Search active calls" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="btn btn-ghost btn-sm" onClick={refresh}><RefreshIcon />Refresh</button></div></div>
    <div className="table-scroll"><table className="report-table"><thead><tr><th>Relationship</th><th>Trunk Group</th><th>Start</th><th>ANI</th><th>DNIS</th><th className="num">Duration</th></tr></thead><tbody>{filtered?.map((row, index) => <tr key={`${row.start}-${index}`}><td>{row.relationship}</td><td>{row.trunkGroup}</td><td>{formatUtc(row.start)}</td><td>{row.ani}</td><td>{row.dnis}</td><td className="num">{formatDuration(row.duration)}</td></tr>)}</tbody></table></div>
    {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No live calls" description="Active calls will appear here automatically." />}
  </section>;
}

function CdrExportsPanel({ rows, query, setQuery }: { rows: CdrExportRow[] | null; query: string; setQuery: (value: string) => void }) {
  const filtered = rows?.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  return <section className="panel table-panel cdr-results-panel">
    <div className="cdr-results-head"><div><h2>CDR exports</h2><p>Previously generated files scoped to this account</p></div><input className="search-input" placeholder="Search exports" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <div className="table-scroll"><table className="report-table"><thead><tr><th>Export Name</th><th>Export Date</th><th>Status</th><th>Period</th><th>Export User</th></tr></thead><tbody>{filtered?.map((row) => <tr key={`${row.exportName}-${row.exportDate}`}><td>{row.exportName}</td><td>{formatUtc(row.exportDate)}</td><td><span className="tag tag-ok">{row.status}</span></td><td>{row.period}</td><td>{row.exportUser}</td></tr>)}</tbody></table></div>
    {rows === null ? <div className="chart-skeleton compact-skeleton" /> : filtered?.length === 0 && <EmptyState title="No CDR exports" description="Scoped export history will appear here when available." />}
  </section>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-glyph" aria-hidden /><div className="empty-title">{title}</div><div className="empty-sub">{description}</div></div>;
}
