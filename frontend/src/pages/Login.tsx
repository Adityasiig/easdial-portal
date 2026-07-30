import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { brand } from '../theme/brand';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand-mark">
          <span className="brand-logo" style={{ background: brand.primary }}>
            ))
          </span>
          <div>
            <div className="brand-name">{brand.name}</div>
            <div className="brand-sub">{brand.productName}</div>
          </div>
        </div>

        <h1>Sign in</h1>
        {error && <div className="alert alert-error">{error}</div>}

        <label>
          Email
          <input
            type="email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="hint">Sign in with your carrier credentials.</p>
      </form>
    </div>
  );
}
