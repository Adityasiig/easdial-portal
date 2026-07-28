import { brand } from '../theme/brand';

const items = ['Dashboard', 'Relationships', 'Reports', 'Tools', 'Settings', 'Help'];

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
        {items.map((label, i) => (
          <a key={label} className={`nav-item ${i === 0 ? 'active' : ''}`} href="#">
            {label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
