import { useEffect, useState } from 'react';
import { api, type Direction, type PartyRole, type RelPerformanceRow } from '../api/client';
import { DateRangePicker } from '../components/DateRangePicker';
import { Shell } from '../components/Shell';

const fmt = (value: number) => Math.round(value).toLocaleString();
const toIso = (value: string) => new Date(`${value}${value.length === 16 ? ':00' : ''}Z`).toISOString();
const todayRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  return { start: start.toISOString().slice(0, 19), end: end.toISOString().slice(0, 19) };
};

type TopTab = { key: string; direction: Direction };
const TOP_TABS: TopTab[] = [
  { key: 'Termination', direction: 'termination' },
  { key: 'Origination', direction: 'origination' },
  { key: 'Termination Media', direction: 'termination' },
  { key: 'Origination Media', direction: 'origination' },
  { key: 'Termination Capacity', direction: 'termination' },
  { key: 'Origination Capacity', direction: 'origination' },
];

export function RelationshipPerformance() {
  const initial = todayRange();
  const [top, setTop] = useState(TOP_TABS[0]);
  const [role, setRole] = useState<PartyRole>('customer');
  const [startTime, setStartTime] = useState(initial.start);
  const [endTime, setEndTime] = useState(initial.end);
  const [range, setRange] = useState('today');
  const [rows, setRows] = useState<RelPerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (direction = top.direction, nextRole = role, start = startTime, end = endTime) => {
    setRows(null);
    setError(null);
    api.relPerformance(direction, nextRole, toIso(start), toIso(end)).then(setRows).catch((err) => setError(err.message));
  };

  useEffect(() => { load(); }, []); // initial report

  const chooseTop = (next: TopTab) => {
    setTop(next);
    load(next.direction, role);
  };

  const chooseRole = (next: PartyRole) => {
    setRole(next);
    load(top.direction, next);
  };

  const changePreset = (next: string) => {
    setRange(next);
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    if (next === 'today') {
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    } else if (next === 'yesterday') {
      start.setUTCDate(start.getUTCDate() - 1);
      end.setUTCDate(end.getUTCDate() - 1);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    } else if (next === 'last-7-days') {
      start.setUTCDate(start.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
    } else return;
    setStartTime(start.toISOString().slice(0, 19));
    setEndTime(end.toISOString().slice(0, 19));
  };

  const exportCsv = () => {
    if (!rows?.length) return;
    const records = [['Relationship', 'Attempts', 'Completions', 'Minutes', 'ASR', 'ALOC', 'SDR', 'MOS'], ...rows.map((row) => [row.name, row.attempts, row.completions, row.minutes, row.asr, row.aloc, row.sdr, row.mos])];
    const csv = records.map((record) => record.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `easdial-relationship-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell title="Relationship Performance">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs page-tabs">
        {TOP_TABS.map((item) => <button key={item.key} className={`tab ${item.key === top.key ? 'tab-active' : ''}`} onClick={() => chooseTop(item)}>{item.key}</button>)}
      </div>

      <div className="performance-filter-row">
        <select className="control-select preset-select" value={range} aria-label="Performance time range" onChange={(event) => changePreset(event.target.value)}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last-7-days">Last 7 Days</option>
          <option value="custom">Custom</option>
        </select>
        <DateRangePicker start={startTime} end={endTime} onChange={(start, end) => { setRange('custom'); setStartTime(start); setEndTime(end); }} />
      </div>

      <div className="performance-subrow">
        <div className="tabs performance-role-tabs">
          {(['customer', 'vendor'] as PartyRole[]).map((item) => <button key={item} className={`tab ${role === item ? 'tab-active' : ''}`} onClick={() => chooseRole(item)}>{item === 'customer' ? 'Customer' : 'Vendor'}</button>)}
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => load()}>Generate</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!rows?.length}>Export</button>
        </div>
      </div>

      <section className="panel table-panel performance-table-panel">
        <div className="table-scroll">
          <table className="report-table">
            <thead><tr><th>Relationships</th><th className="num">Attempts</th><th className="num">Completions</th><th className="num">Minutes</th><th className="num">ASR %</th><th className="num">ALOC</th><th className="num">SDR %</th><th className="num">MOS</th></tr></thead>
            <tbody>{rows?.map((row) => <tr key={row.name}><td>{row.name}</td><td className="num">{fmt(row.attempts)}</td><td className="num">{fmt(row.completions)}</td><td className="num">{fmt(row.minutes)}</td><td className="num">{row.asr.toFixed(2)}</td><td className="num">{row.aloc.toFixed(2)}</td><td className="num">{row.sdr.toFixed(2)}</td><td className="num">{row.mos.toFixed(2)}</td></tr>)}</tbody>
          </table>
        </div>
        {rows === null && <div className="chart-skeleton compact-skeleton" />}
        {rows !== null && rows.length === 0 && <div className="empty-state"><EmptyBoxIcon /><div className="empty-sub">No data for this range</div></div>}
      </section>
    </Shell>
  );
}

export function EmptyBoxIcon() {
  return <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c3cad6" strokeWidth="1.6" aria-hidden><path d="M4 9l8-4 8 4-8 4-8-4z"/><path d="M4 9v6l8 4 8-4V9"/></svg>;
}
