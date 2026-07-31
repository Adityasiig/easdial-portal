import { useEffect, useState } from 'react';
import { api, type InvoiceRow } from '../api/client';
import { Shell } from '../components/Shell';
import { SearchIcon } from './SendPayment';

const money = (n: number) => `$${n.toFixed(2)}`;

export function Invoices() {
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.invoices().then(setRows).catch((e) => setError(e.message));
  }, []);

  const filtered = rows?.filter((r) => !q || r.invoiceNumber.toLowerCase().includes(q.toLowerCase()));

  return (
    <Shell title="Invoices">
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
                <th>Invoice Number</th>
                <th>Validity</th>
                <th>Created At</th>
                <th>Start-End Date</th>
                <th>Invoice Cycle</th>
                <th className="num">Invoice Amount</th>
                <th>Tag</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r) => (
                <tr key={r.invoiceNumber}>
                  <td>{r.invoiceNumber}</td>
                  <td>{r.validity}</td>
                  <td>{r.createdAt}</td>
                  <td>{r.startEndDate}</td>
                  <td>{r.invoiceCycle}</td>
                  <td className="num">{money(r.invoiceAmount)}</td>
                  <td>
                    <span className={`tag ${r.tag === 'Paid' ? 'tag-ok' : 'tag-info'}`}>{r.tag}</span>
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
      </section>
    </Shell>
  );
}
