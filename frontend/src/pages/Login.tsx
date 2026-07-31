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
    <main className="auth-shell">
      <section className="auth-card-wrap">
        <div className="brand-mark auth-brand">
          <span className="brand-symbol">))</span>
          <span className="brand-name">{brand.name}</span>
        </div>
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-form-head">
            <h1>Sign in</h1>
            <p>Sign in to access your carrier portal.</p>
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
          <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="auth-legal">© {new Date().getFullYear()} {brand.company}</p>
      </section>
    </main>
  );
}
