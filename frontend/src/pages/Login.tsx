import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { brand } from '../theme/brand';

export function Login() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
  }, [navigate, ready, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual" aria-label="EasDial carrier operations">
        <div className="brand-mark auth-brand">
          <span className="brand-symbol">))</span>
          <span className="brand-name">{brand.name}</span>
        </div>
        <div className="auth-statement">
          <span className="auth-index">01 / CARRIER OPERATIONS</span>
          <h1>Every call.<br />Clearly measured.</h1>
          <p>Live relationship performance, CDR diagnostics, rates, and accounting in one focused workspace.</p>
        </div>
        <div className="auth-signal" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="auth-meta"><span>LIVE NETWORK DATA</span><span>GMT / 24H</span></div>
      </section>
      <section className="auth-panel">
      <div className="auth-card-wrap">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-form-head">
            <span>Secure access</span>
            <h2>Sign in</h2>
            <p>Use your assigned carrier portal credentials.</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <label>
            <span>Email address</span>
            <input type="email" value={email} autoComplete="username" placeholder="name@company.com" onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} autoComplete="current-password" placeholder="Enter password" onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="btn btn-primary auth-submit" disabled={busy}><span>{busy ? 'Signing in…' : 'Enter workspace'}</span><b aria-hidden="true">→</b></button>
        </form>
        <p className="auth-legal">© {new Date().getFullYear()} {brand.company}</p>
      </div>
      </section>
    </main>
  );
}
