import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { brand } from '../theme/brand';

export function SetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError('Passwords do not match');
    if (password.length < 10) return setError('Password must be at least 10 characters');
    setBusy(true);
    try {
      await api.setPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set password');
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
            <div className="brand-sub">Set your password</div>
          </div>
        </div>

        {!token && <div className="alert alert-error">Missing or invalid setup link.</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {done ? (
          <div className="alert alert-ok">Password set. Redirecting to sign in…</div>
        ) : (
          <>
            <label>
              New password
              <input
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" disabled={busy || !token}>
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
