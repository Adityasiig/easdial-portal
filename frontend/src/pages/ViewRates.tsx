import { useEffect, useState } from 'react';
import { api, type RateRow } from '../api/client';
import { Shell } from '../components/Shell';
import { SearchIcon } from './SendPayment';

const TABS = ['Standard', 'Global'] as const;
type Tab = (typeof TABS)[number];

export function ViewRates() {
  const [tab, setTab] = useState<Tab>('Standard');
  const [rows, setRows] = useState<RateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.rates().then(setRows).catch((e) => setError(e.message));
  }, []);

  // Global tab mirrors Standard until global rate decks are exposed.
  const scoped = tab === 'Standard' ? rows : rows === null ? null : [];
  const filtered = scoped?.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Shell title="View Rates">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs page-tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${t === tab ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
            {t}
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
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Trunk Groups</th>
                <th>Direction</th>
                <th>Relationship</th>
                <th>Location</th>
                <th>Type</th>
                <th className="num">Total Rates</th>
                <th>Expiration Date</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">
                    <span className="badge">{r.trunkGroups}</span>
                  </td>
                  <td>{r.direction}</td>
                  <td>{r.relationship}</td>
                  <td>{r.location}</td>
                  <td>{r.type}</td>
                  <td className="num">{r.totalRates.toLocaleString()}</td>
                  <td>{r.expirationDate ?? '-'}</td>
                  <td>{r.modified.replace(/-/g, '/')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows === null && !error && <div className="chart-skeleton" style={{ height: 160 }} />}
        {filtered !== undefined && filtered.length === 0 && (
          <div className="empty-state">
            <SearchIcon />
            <div className="empty-title">No Results Found</div>
          </div>
        )}
        <div className="table-pagination">
          <span>{filtered?.length ? `1 - ${filtered.length} of ${filtered.length}` : '0 - 0 of 0'}</span>
          <span>Rows per page: 10</span>
        </div>
      </section>
    </Shell>
  );
}
