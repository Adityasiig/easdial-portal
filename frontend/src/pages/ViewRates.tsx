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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    api.rates().then(setRows).catch((e) => setError(e.message));
  }, []);

  // Global tab mirrors Standard until global rate decks are exposed.
  const scoped = tab === 'Standard' ? rows : rows === null ? null : [];
  const filtered = scoped?.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));

  const downloadRateDeck = async (rate: RateRow) => {
    setDownloadingId(rate.id);
    setError(null);
    try {
      const { blob, filename } = await api.rateDeck(rate.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rate deck download failed');
    } finally {
      setDownloadingId(null);
    }
  };

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
            aria-label="Search rates"
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
                <th>Rates</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r) => (
                <tr key={r.id}>
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
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => void downloadRateDeck(r)}
                      disabled={downloadingId !== null}
                      aria-label={`Download ${r.name} rates as CSV`}
                    >
                      <DownloadIcon />
                      {downloadingId === r.id ? 'Downloading...' : 'Download CSV'}
                    </button>
                  </td>
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

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
