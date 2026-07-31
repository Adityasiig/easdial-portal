import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../theme/brand';

function useGmtClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} GMT`;
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const clock = useGmtClock();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = (user?.email?.[0] ?? 'E').toUpperCase();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content-col">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-right">
            <span className="topstat">
              Active Calls: <b>0</b>
            </span>
            <span className="topbar-sep" />
            <span className="topstat">
              Active CPS: <b>0</b>
            </span>
            <span className="topbar-sep" />
            <span className="clock">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {clock}
            </span>
            <div className="avatar-wrap">
              <button className="avatar" onClick={() => setMenuOpen((v) => !v)} title={user?.email}>
                {initial}
              </button>
              {menuOpen && (
                <div className="avatar-menu">
                  <div className="avatar-menu-email">{user?.email}</div>
                  <button className="btn btn-link" onClick={logout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
        <footer className="page-footer">
          <span>{brand.company}</span>
          <span>© {new Date().getFullYear()} | All Rights Reserved.</span>
        </footer>
      </main>
    </div>
  );
}
