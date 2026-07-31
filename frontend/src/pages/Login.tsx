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
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-showcase">
        <div className="auth-showcase-inner">
          <div className="brand-mark auth-brand">
            <span className="brand-logo">E</span>
            <div><div className="brand-name">{brand.name}</div><div className="brand-sub">{brand.productName}</div></div>
          </div>

          <div className="auth-copy">
            <span className="auth-kicker"><span className="status-dot" /> Connected globally</span>
            <h1>Your voice network.<br />Crystal clear.</h1>
            <p>Monitor performance, inspect every call, and manage carrier finances from one secure workspace.</p>
          </div>

          <div className="signal-card">
            <div className="signal-card-head"><span>Live network</span><span>Operational</span></div>
            <div className="signal-bars" aria-hidden>
              {[34, 48, 41, 68, 54, 82, 61, 88, 72, 96, 76, 91, 68, 84, 58, 72, 47, 62].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="signal-meta"><span>Real-time visibility</span><span>24/7 monitoring</span></div>
          </div>
        </div>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-form-head">
            <span className="auth-form-kicker">Welcome back</span>
            <h2>Sign in to your portal</h2>
            <p>Use your carrier credentials to continue.</p>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <label>
            <span>Email address</span>
            <input type="email" value={email} autoComplete="username" placeholder="name@company.com" onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} autoComplete="current-password" placeholder="Enter your password" onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="btn btn-primary auth-submit" disabled={busy}>
            <span>{busy ? 'Signing in…' : 'Sign in securely'}</span>{!busy && <span aria-hidden>→</span>}
          </button>
          <p className="hint"><span className="lock-dot">✓</span> Encrypted and protected access</p>
        </form>
        <p className="auth-legal">© {new Date().getFullYear()} {brand.company} · Secure carrier access</p>
      </section>
    </div>
  );
}
