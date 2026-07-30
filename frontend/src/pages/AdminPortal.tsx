import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type RelationshipRef, type SessionUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../theme/brand';

export function AdminPortal() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [relationshipId, setRelationshipId] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [u, r] = await Promise.all([api.admin.users(), api.admin.relationships()]);
      setUsers(u);
      setRelationships(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const rel = relationships.find((r) => r.id === relationshipId);
    if (!rel) return setError('Pick a relationship to allocate.');
    setBusy(true);
    try {
      await api.admin.createUser({ email, password, relationshipId: rel.id, relationshipName: rel.name });
      setNotice(`Created ${email} → ${rel.name}`);
      setEmail('');
      setPassword('');
      setRelationshipId('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Delete ${label}?`)) return;
    await api.admin.deleteUser(id).catch(() => undefined);
    await refresh();
  }

  return (
    <div className="admin-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span className="brand-logo" style={{ background: brand.primary }}>
            ))
          </span>
          <div>
            <div className="brand-name">{brand.name} Admin</div>
            <div className="brand-sub">User &amp; relationship management</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="who">{user?.email}</span>
          <button className="btn btn-link" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-ok">{notice}</div>}

      <section className="panel">
        <h2>Create a portal user</h2>
        <form className="admin-form" onSubmit={onCreate}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="min 8 characters"
              required
            />
          </label>
          <label>
            Dedicated relationship
            <select value={relationshipId} onChange={(e) => setRelationshipId(e.target.value)} required>
              <option value="">Select an ED relationship…</option>
              {relationships.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (#{r.id})
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </form>
        <p className="hint">{relationships.length} ED relationships available to allocate.</p>
      </section>

      <section className="panel">
        <h2>Portal users</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Allocated relationship</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.relationshipName ? `${u.relationshipName} (#${u.relationshipId})` : '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  {u.role !== 'admin' && (
                    <button className="btn btn-link btn-danger" onClick={() => onDelete(u.id, u.email)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
