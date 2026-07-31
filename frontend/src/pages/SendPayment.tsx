import { useEffect, useState } from 'react';
import { api, type PaymentRow } from '../api/client';
import { Shell } from '../components/Shell';

const TABS = ['Paypal', 'Stripe'] as const;
type Tab = (typeof TABS)[number];

const money = (n: number) => `$${n.toFixed(2)}`;

export function SendPayment() {
  const [tab, setTab] = useState<Tab>('Paypal');
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.payments().then(setRows).catch((e) => setError(e.message));
  }, []);

  const filtered = rows?.filter(
    (r) =>
      !q ||
      r.carrierName.toLowerCase().includes(q.toLowerCase()) ||
      r.invoiceId.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <Shell title="Send Payment">
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-ok">{notice}</div>}

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
          <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
            ➤ Send Payment
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="report-table">
            <thead>
              <tr>
                <th>Carrier Name</th>
                <th>Description</th>
                <th>Invoice ID</th>
                <th className="num">Total Amount</th>
                <th>Paid To</th>
                <th className="num">Paypal Fee</th>
                <th>Purchased At</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r, i) => (
                <tr key={i}>
                  <td>{r.carrierName}</td>
                  <td>{r.description}</td>
                  <td>{r.invoiceId}</td>
                  <td className="num">{money(r.totalAmount)}</td>
                  <td>{r.paidTo}</td>
                  <td className="num">{money(r.paypalFee)}</td>
                  <td>{r.purchasedAt}</td>
                  <td>{r.reason}</td>
                  <td>
                    <span className="tag tag-ok">{r.status}</span>
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
            <div className="empty-title">No Payment</div>
            <div className="empty-sub">Get started by adding a new payment.</div>
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
              ➤ Send Payment
            </button>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">Send {tab} Payment</div>
            <div className="modal-body">
              <div className="modal-field">
                <div className="modal-label">Receiving Account</div>
                <div>accounts@dialphone.ai</div>
              </div>
              <label className="modal-field">
                <div className="modal-label">
                  Amount <span className="req">*</span>
                </div>
                <input className="control-input" placeholder="$ 0.00" />
              </label>
              <label className="modal-field">
                <div className="modal-label">Description</div>
                <textarea className="control-input" rows={3} placeholder="Description" />
              </label>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setModalOpen(false);
                  setNotice('Online payments are not enabled on this portal yet — contact your account manager.');
                }}
              >
                Send Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

export function SearchIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c3cad6" strokeWidth="1.6" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" strokeLinecap="round" />
    </svg>
  );
}
