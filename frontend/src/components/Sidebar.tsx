import { NavLink } from 'react-router-dom';
import { brand } from '../theme/brand';

const items = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/reports', label: 'Reports' },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand-mark sidebar-brand">
        <span className="brand-logo" style={{ background: brand.primary }}>
          ))
        </span>
        <span className="brand-name">{brand.name}</span>
      </div>
      <nav>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {it.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
