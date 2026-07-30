import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, setToken, type SessionUser } from '../api/client';

interface AuthState {
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  const value = useMemo<AuthState>(
    () => ({
      user,
      async login(email, password) {
        const { token, user: u } = await api.login(email, password);
        setToken(token);
        setUser(u);
        return u;
      },
      logout() {
        void api.logout().catch(() => undefined);
        setToken(null);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
