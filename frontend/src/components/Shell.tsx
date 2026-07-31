import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../theme/brand';

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-right">
            <span className="clock">{brand.tz}</span>
            <span className="who">{user?.email}</span>
            <button className="btn btn-link" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
