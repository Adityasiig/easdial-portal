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
    <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" />
    <rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" />
  </svg>
);
const IconReport = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="7" width="4" height="14" rx="1" />
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
    <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h4" strokeLinecap="round" />
  </svg>
);

const NAV: Array<{ section: string; items: Array<Item | Group> }> = [
  { section: 'Workspace', items: [{ to: '/dashboard', label: 'Dashboard', icon: IconDash }] },
  {
    section: 'Operations',
    items: [
      {
        label: 'Reporting', icon: IconReport,
        children: [
          { to: '/reportings/relationship', label: 'Relationship performance' },
          { to: '/reportings/numbering', label: 'Numbering' },
        ],
      },
      { to: '/call-diagnostic', label: 'Call diagnostic', icon: IconDiag },
    ],
  },
  {
    section: 'Finance',
    items: [{
      label: 'Accounting', icon: IconAcct,
      children: [
        { to: '/accounting/send-payment', label: 'Send payment' },
        { to: '/accounting/invoices', label: 'Invoices' },
        { to: '/accounting/view-rates', label: 'View rates' },
        { to: '/accounting/carrier-payments', label: 'Carrier payments' },
      ],
    }],
  },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar({ visible = false, onClose }: { visible?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of NAV) {
      for (const item of section.items) {
        if ('children' in item) initial[item.label] = item.children.some((c) => pathname.startsWith(c.to));
      }
    }
    return initial;
  });

  return (
    <aside className={`sidebar ${visible ? 'sidebar-open' : ''}`}>
      <div className="brand-mark sidebar-brand">
        <span className="brand-logo">E</span>
        <span className="brand-text"><span className="brand-name">{brand.name}</span><span className="brand-sub">{brand.productName}</span></span>
        <button className="sidebar-close" aria-label="Close navigation" onClick={onClose}>×</button>
      </div>
      <nav>
        {NAV.map((section) => (
          <div className="nav-section" key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => 'children' in item ? (
              <div key={item.label} className="nav-group">
                <button
                  className={`nav-item nav-parent ${item.children.some((c) => pathname.startsWith(c.to)) ? 'parent-active' : ''}`}
                  onClick={() => setExpanded((current) => ({ ...current, [item.label]: !current[item.label] }))}
                >
                  <span className="nav-icon"><item.icon /></span><span className="nav-label">{item.label}</span>
                  <Chevron open={!!expanded[item.label]} />
                </button>
                {expanded[item.label] && (
                  <div className="nav-children">
                    {item.children.map((child) => (
                      <NavLink key={child.to} to={child.to} onClick={onClose} className={({ isActive }) => `nav-child ${isActive ? 'active' : ''}`}>
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon"><item.icon /></span><span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-status">
        <div className="status-icon"><span className="status-dot" /></div>
        <div><strong>All systems operational</strong><span>Global voice network</span></div>
      </div>
    </aside>
  );
}
