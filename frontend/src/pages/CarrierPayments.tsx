import { useEffect, useState } from 'react';
import { api, type TransactionRow } from '../api/client';
import { Shell } from '../components/Shell';
import { SearchIcon } from '../components/SearchIcon';

const GROUPS = ['All Transactions', 'NRC', 'MRC'] as const;
type Group = (typeof GROUPS)[number];
const SUB_TABS = ['All', 'Credit', 'Payment'] as const;
type SubTab = (typeof SUB_TABS)[number];

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

export function CarrierPayments() {
  const [group, setGroup] = useState<Group>('All Transactions');
  const [sub, setSub] = useState<SubTab>('All');
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.transactions().then(setRows).catch((e) => setError(e.message));
  }, []);

  const scoped = group === 'All Transactions' ? rows : rows === null ? null : [];
  const filtered = scoped?.filter((r) => {
    if (sub !== 'All' && r.type !== sub) return false;
    if (q && !(r.transaction.toLowerCase().includes(q.toLowerCase()) || r.paymentMemo.toLowerCase().includes(q.toLowerCase())))
      return false;
    return true;
  });

  return (
    <Shell title="Carrier Payments">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="section-head">
        <h2 className="section-title">{group}</h2>
        <div className="seg-group">
          {GROUPS.map((g) => (
            <button key={g} className={`seg ${g === group ? 'seg-active' : ''}`} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="tabs">
        {SUB_TABS.map((s) => (
          <button key={s} className={`tab ${s === sub ? 'tab-active' : ''}`} onClick={() => setSub(s)}>
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
          <button className="btn btn-ghost btn-sm" disabled>
            Export
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction</th>
                <th>Type</th>
                <th>Transaction Date</th>
                <th className="num">Amount</th>
                <th className="num">Running Balance</th>
                <th>Payment Memo</th>
                <th>Added From</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.transaction}</td>
                  <td>{r.type}</td>
                  <td>{r.transactionDate}</td>
                  <td className={`num ${r.amount < 0 ? 'stat-neg' : ''}`}>{money(r.amount)}</td>
                  <td className="num">{money(r.runningBalance)}</td>
                  <td>{r.paymentMemo}</td>
                  <td>{r.addedFrom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows === null && !error && <div className="chart-skeleton" style={{ height: 160 }} />}
        {filtered !== undefined && filtered.length === 0 && (
          <div className="empty-state">
            <SearchIcon />
            <div className="empty-title">No Transaction</div>
            <div className="empty-sub">Get started by adding a new transaction.</div>
          </div>
        )}
      </section>
    </Shell>
  );
}
