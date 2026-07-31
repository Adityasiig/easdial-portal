import { useEffect, useState } from 'react';
import { api, type NumberingRow } from '../api/client';
import { Shell } from '../components/Shell';
import { EmptyBoxIcon } from './RelationshipPerformance';

export function Numbering() {
  const [rows, setRows] = useState<NumberingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.numbering().then(setRows).catch((e) => setError(e.message));
  }, []);

  const filtered = rows?.filter((r) => r.number.includes(q) || r.type.toLowerCase().includes(q.toLowerCase()));

  return (
    <Shell title="Numbering">
      {error && <div className="alert alert-error">{error}</div>}

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
                <th>Number</th>
                <th>Type</th>
                <th>Last Modified</th>
                <th>Modified By</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r) => (
                <tr key={r.number}>
                  <td>{r.number}</td>
                  <td>{r.type}</td>
                  <td>{r.lastModified}</td>
                  <td>{r.modifiedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows === null && <div className="chart-skeleton" style={{ height: 160 }} />}
        {filtered !== undefined && filtered.length === 0 && (
          <div className="empty-state">
            <EmptyBoxIcon />
            <div className="empty-title">No Results Found</div>
          </div>
        )}
        <div className="table-pagination">
          <span>
            {filtered?.length ? `1 - ${filtered.length} of ${filtered.length}` : '0 - 0 of 0'}
          </span>
          <span>Rows per page: 10</span>
        </div>
      </section>
    </Shell>
  );
}
