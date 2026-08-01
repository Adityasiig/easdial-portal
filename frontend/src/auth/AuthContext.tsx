import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, hasStoredToken, setToken, type SessionUser } from '../api/client';

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(!hasStoredToken());

  useEffect(() => {
    if (!hasStoredToken()) return;
    let active = true;
    api.me()
      .then(({ user: restored }) => {
        if (active) setUser(restored);
      })
      .catch(() => setToken(null))
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      async login(email, password) {
        const { token, user: u } = await api.login(email, password);
        setToken(token);
        setUser(u);
        setReady(true);
        return u;
      },
      logout() {
        void api.logout().catch(() => undefined);
        setToken(null);
        setUser(null);
        setReady(true);
      },
    }),
    [ready, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
