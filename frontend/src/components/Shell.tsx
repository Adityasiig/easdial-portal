import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../theme/brand';
import { api, type UpstreamHealth } from '../api/client';

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
  const [navOpen, setNavOpen] = useState(false);
  const [upstream, setUpstream] = useState<UpstreamHealth | null>(null);
  const initial = (user?.email?.[0] ?? 'E').toUpperCase();

  useEffect(() => {
    let active = true;
    void api.upstreamHealth().then((health) => active && setUpstream(health)).catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar visible={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
      <main className="content-col">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
              <span />
              <span />
              <span />
            </button>
            <div className="topbar-copy">
              <span>Carrier workspace</span>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-right">
            <span className="clock">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {clock}
            </span>
            <div className="avatar-wrap">
              <button
                className="avatar"
                onClick={() => setMenuOpen((v) => !v)}
                title={user?.email}
                aria-label="Open account menu"
                aria-expanded={menuOpen}
              >
                {initial}
              </button>
              {menuOpen && (
                <div className="avatar-menu">
                  <div className="avatar-menu-label">Signed in as</div>
                  <div className="avatar-menu-email">{user?.email}</div>
                  <button className="btn btn-link" onClick={logout}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {upstream?.source === 'mock' && (
          <div className="data-source-banner" role="status">
            Demo data is active. Connect the live Peeredge relationship source before using these figures operationally.
          </div>
        )}
        <div className="content">{children}</div>
        <footer className="page-footer">
          <span>{brand.company}</span>
          <span>© {new Date().getFullYear()} · All rights reserved</span>
        </footer>
      </main>
    </div>
  );
}
