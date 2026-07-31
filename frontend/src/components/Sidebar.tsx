import { useState } from 'react';
import type { JSX } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { brand } from '../theme/brand';

type ReactIcon = () => JSX.Element;
type Leaf = { to: string; label: string };
type Group = { label: string; icon: ReactIcon; children: Leaf[] };
type Item = { to: string; label: string; icon: ReactIcon };

const IconDash = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="5" rx="1.5" />
    <rect x="13" y="10" width="8" height="11" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
  </svg>
);
const IconReport = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
);
const IconDiag = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 12h4l2-6 4 12 2-6h6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconAcct = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 11h8M8 15h4" strokeLinecap="round" />
  </svg>
);

const NAV: Array<Item | Group> = [
  { to: '/dashboard', label: 'Dashboard', icon: IconDash },
  {
    label: 'Reportings',
    icon: IconReport,
    children: [
      { to: '/reportings/relationship', label: 'Relationship Performance' },
      { to: '/reportings/numbering', label: 'Numbering' },
    ],
  },
  { to: '/call-diagnostic', label: 'Call Diagnostic', icon: IconDiag },
  {
    label: 'Accounting',
    icon: IconAcct,
    children: [
      { to: '/accounting/send-payment', label: 'Send Payment' },
      { to: '/accounting/invoices', label: 'Invoices' },
      { to: '/accounting/view-rates', label: 'View Rates' },
      { to: '/accounting/carrier-payments', label: 'Carrier Payments' },
    ],
  },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const item of NAV) {
      if ('children' in item) init[item.label] = item.children.some((c) => pathname.startsWith(c.to));
    }
    return init;
  });

  return (
    <aside className="sidebar">
      <div className="brand-mark sidebar-brand">
        <span className="brand-logo" style={{ background: brand.primary }}>
          ))
        </span>
        <span className="brand-name">{brand.name}</span>
      </div>
      <nav>
        {NAV.map((item) =>
          'children' in item ? (
            <div key={item.label} className="nav-group">
              <button
                className={`nav-item nav-parent ${item.children.some((c) => pathname.startsWith(c.to)) ? 'parent-active' : ''}`}
                onClick={() => setOpen((o) => ({ ...o, [item.label]: !o[item.label] }))}
              >
                <span className="nav-icon">
                  <item.icon />
                </span>
                <span className="nav-label">{item.label}</span>
                <Chevron open={!!open[item.label]} />
              </button>
              {open[item.label] && (
                <div className="nav-children">
                  {item.children.map((c) => (
                    <NavLink
                      key={c.to}
                      to={c.to}
                      className={({ isActive }) => `nav-child ${isActive ? 'active' : ''}`}
                    >
                      {c.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">
                <item.icon />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ),
        )}
      </nav>
    </aside>
  );
}
