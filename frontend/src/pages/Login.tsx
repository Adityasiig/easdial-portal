import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../api/client';
import { brand } from '../theme/brand';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!email) return setError('Enter your email first, then click reset.');
    setError(null);
    await api.requestReset(email).catch(() => undefined);
    setResetSent(true);
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
        {resetSent && (
          <div className="alert alert-ok">
            If that email exists, a reset link is on its way.
          </div>
        )}

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
        <button type="button" className="btn btn-link" onClick={onReset}>
          Forgot password?
        </button>

        <p className="hint">
          Demo: <code>carrier@easdial.com</code> / <code>EasDialDemo!2026</code>
        </p>
      </form>
    </div>
  );
}
